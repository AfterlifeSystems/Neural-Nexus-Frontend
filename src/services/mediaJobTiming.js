// src/services/mediaJobTiming.js
//
// How long an identity-media upload is expected to take, and how to tell
// when the server has lost it.
//
// The API probes every audio or video item's length at submit and multiplies
// that length by MEDIA_PREPROCESSING_SECONDS_PER_MEDIA_SECOND (about one
// second of processing per second of media). The estimate rides on the 202
// body, on GET /media_jobs and GET /media_job/{id} rows, and on every frame of
// the GET /media_job/{id}/progress stream together with the seconds elapsed
// so far. This module turns those numbers into the "about 39 min · 28 min
// left" line on the upload card and keeps the countdown honest between
// frames.
//
// Jobs live only in the API process's memory. When that process restarts the
// job is gone: the stream closes without a `done` frame (or hangs on a dead
// socket), and GET /media_job/{id} answers 404. The constants below name that
// failure so the card says so instead of spinning forever.

/**
 * The progress stream sends a keep-alive frame every 15 seconds while the
 * pipeline is silent. Four missed keep-alives means the socket is dead even
 * though the browser has not noticed.
 */
export const MEDIA_JOB_STALL_TIMEOUT_MS = 60_000;

/** How many times a dropped stream is re-opened before the card gives up. */
export const MEDIA_JOB_RECONNECT_ATTEMPTS = 3;

/** Pause between reconnect attempts, long enough for a restart to finish. */
export const MEDIA_JOB_RECONNECT_DELAY_MS = 3_000;

export const MEDIA_JOB_LOST_MESSAGE =
  'The server lost track of this upload (it restarted while processing). Nothing was saved — add it again.';

export const MEDIA_JOB_UNREACHABLE_MESSAGE =
  'The progress stream dropped and the server could not be reached to check on this upload.';

const finiteOrNull = (value) => {
  const number = typeof value === 'string' ? Number(value) : value;
  return typeof number === 'number' && Number.isFinite(number) ? number : null;
};

/**
 * Timing carried by one progress frame (`status`, `media_progress`,
 * `keep_alive`, or `done`).
 *
 * @param {Object} frame A parsed `data:` payload.
 * @param {number} [nowMs] When the frame was observed.
 * @returns {Object|null} A timing patch, or null when the frame has no timing.
 */
export const timingFromMediaJobFrame = (frame, nowMs = Date.now()) => {
  if (!frame || typeof frame !== 'object') return null;
  const estimatedProcessingSeconds = finiteOrNull(frame.estimated_processing_seconds);
  const estimatedMediaSeconds = finiteOrNull(frame.estimated_media_seconds);
  const elapsedSeconds = finiteOrNull(frame.elapsed_seconds);
  const startedAtEpochSeconds = finiteOrNull(frame.started_at);
  const durationSeconds = finiteOrNull(frame.duration_seconds);
  if (
    estimatedProcessingSeconds == null &&
    estimatedMediaSeconds == null &&
    elapsedSeconds == null &&
    startedAtEpochSeconds == null &&
    durationSeconds == null
  ) {
    return null;
  }
  return {
    estimatedProcessingSeconds,
    estimatedMediaSeconds,
    elapsedSeconds,
    startedAtEpochSeconds,
    durationSeconds,
    observedAtMs: nowMs,
  };
};

/**
 * Timing carried by a GET /media_jobs or GET /media_job/{id} row. Rows have
 * no `elapsed_seconds`; a running job's elapsed time is derived from
 * `started_at` at observation time.
 *
 * @param {Object} entry A list or snapshot row.
 * @param {number} [nowMs] When the row was observed.
 * @returns {Object|null}
 */
export const timingFromMediaJobSnapshot = (entry, nowMs = Date.now()) => {
  const timing = timingFromMediaJobFrame(entry, nowMs);
  if (!timing) return null;
  if (timing.elapsedSeconds == null && timing.startedAtEpochSeconds != null) {
    const finishedAtEpochSeconds = finiteOrNull(entry.finished_at);
    const endSeconds = finishedAtEpochSeconds ?? nowMs / 1000;
    timing.elapsedSeconds = Math.max(0, endSeconds - timing.startedAtEpochSeconds);
  }
  return timing;
};

/**
 * Fold a newer timing patch into the card's timing. The estimate is stable
 * across frames; elapsed time always takes the newest observation.
 *
 * @param {Object|null} current The card's timing so far.
 * @param {Object|null} incoming A patch from a frame or snapshot.
 * @returns {Object|null}
 */
export const mergeMediaJobTiming = (current, incoming) => {
  if (!incoming) return current ?? null;
  if (!current) return incoming;
  return {
    estimatedProcessingSeconds:
      incoming.estimatedProcessingSeconds ?? current.estimatedProcessingSeconds ?? null,
    estimatedMediaSeconds:
      incoming.estimatedMediaSeconds ?? current.estimatedMediaSeconds ?? null,
    elapsedSeconds: incoming.elapsedSeconds ?? current.elapsedSeconds ?? null,
    startedAtEpochSeconds:
      incoming.startedAtEpochSeconds ?? current.startedAtEpochSeconds ?? null,
    durationSeconds: incoming.durationSeconds ?? current.durationSeconds ?? null,
    observedAtMs: incoming.observedAtMs ?? current.observedAtMs ?? null,
  };
};

/**
 * Seconds of processing done so far, projected to `nowMs` from the last
 * observation so the countdown keeps moving between frames.
 *
 * @param {Object|null} timing
 * @param {number} [nowMs]
 * @returns {number|null}
 */
export const elapsedSecondsNow = (timing, nowMs = Date.now()) => {
  if (!timing) return null;
  if (timing.elapsedSeconds != null) {
    const sinceObservation =
      timing.observedAtMs != null ? Math.max(0, (nowMs - timing.observedAtMs) / 1000) : 0;
    return timing.elapsedSeconds + sinceObservation;
  }
  if (timing.startedAtEpochSeconds != null) {
    return Math.max(0, nowMs / 1000 - timing.startedAtEpochSeconds);
  }
  return null;
};

/**
 * @param {Object|null} timing
 * @param {number} [nowMs]
 * @returns {number|null} Seconds still expected, never negative; null without an estimate.
 */
export const remainingSecondsNow = (timing, nowMs = Date.now()) => {
  if (!timing || timing.estimatedProcessingSeconds == null) return null;
  const elapsed = elapsedSecondsNow(timing, nowMs) ?? 0;
  return Math.max(0, timing.estimatedProcessingSeconds - elapsed);
};

/**
 * "under a minute", "about 3 min", "about 1 h 5 min".
 *
 * @param {number} seconds
 * @returns {string}
 */
export const formatDurationEstimate = (seconds) => {
  const total = Math.max(0, Math.round(finiteOrNull(seconds) ?? 0));
  if (total < 60) return 'under a minute';
  const minutes = Math.round(total / 60);
  if (minutes < 60) return `about ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `about ${hours} h` : `about ${hours} h ${rest} min`;
};

/**
 * "12 s", "3 min", "1 h 5 min" — how long something has been running. Exact
 * seconds under a minute so a fresh card visibly moves; whole minutes after.
 *
 * @param {number} seconds
 * @returns {string}
 */
export const formatElapsedDuration = (seconds) => {
  const total = Math.max(0, Math.floor(finiteOrNull(seconds) ?? 0));
  if (total < 60) return `${total} s`;
  const minutes = Math.floor(total / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
};

/**
 * The timing sentence for an upload card.
 *
 * Running always says how long so far: "Running 11 min". With an estimate it
 * adds the outlook — "Running 11 min · about 39 min total · 28 min left", or
 * "Running 41 min · longer than the 39 min estimate" once past it. Finished:
 * "Took 41 min". Null only when nothing about the time is known.
 *
 * @param {Object} job A stored upload card (`status`, `timing`).
 * @param {number} [nowMs]
 * @returns {string|null}
 */
export const describeMediaJobTiming = (job, nowMs = Date.now()) => {
  const timing = job?.timing;
  if (!timing) return null;
  if (job.status === 'running') {
    const elapsed = elapsedSecondsNow(timing, nowMs);
    const runningText = elapsed != null ? `Running ${formatElapsedDuration(elapsed)}` : null;
    if (timing.estimatedProcessingSeconds == null) return runningText;
    const estimateText = formatDurationEstimate(timing.estimatedProcessingSeconds).replace(
      /^about /,
      ''
    );
    const remaining = remainingSecondsNow(timing, nowMs);
    if (remaining != null && remaining <= 0) {
      return runningText
        ? `${runningText} · longer than the ${estimateText} estimate`
        : `Running longer than the ${estimateText} estimate`;
    }
    const remainingText = formatDurationEstimate(remaining ?? 0).replace(/^about /, '');
    const outlook = `about ${estimateText} total · ${remainingText} left`;
    return runningText ? `${runningText} · ${outlook}` : `About ${estimateText} total · ${remainingText} left`;
  }
  if (job.status === 'success' && timing.durationSeconds != null) {
    return `Took ${formatDurationEstimate(timing.durationSeconds).replace(/^about /, '')}`;
  }
  return null;
};
