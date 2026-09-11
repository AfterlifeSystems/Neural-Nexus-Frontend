// src/services/ambientCaptureScheduler.js
//
// The decisions behind the ambient-capture timer, kept free of React and the
// browser so they can be tested: when a tick may capture, how long until the
// next capture, and how the status shown to the person changes as the stream
// of an observation's events arrives.

/** Tell the person about an outage after this many failed observations in a row. */
export const AMBIENT_FAILURE_LIMIT = 3;

export const INITIAL_AMBIENT_STATUS = Object.freeze({
  inFlight: false,
  lastCapturedAt: null,
  lastDecision: null,
  lastSummary: null,
  lastObservationId: null,
  lastError: null,
  consecutiveFailures: 0,
  retryAfterUntil: null,
});

/**
 * Whether ambient vision is running.
 *
 * There is no switch: sharing a webcam or a screen on an account that may run
 * ambient vision starts the looks, and only the last share ending stops them.
 *
 * @param {Object} conditions
 * @param {boolean} conditions.allowed The account may run ambient vision.
 * @param {boolean} conditions.hasWebcam A webcam stream is live.
 * @param {boolean} conditions.hasScreen A screen stream is live.
 * @returns {boolean}
 */
export function isAmbientVisionActive({ allowed, hasWebcam, hasScreen }) {
  if (!allowed) return false;
  return Boolean(hasWebcam || hasScreen);
}

/**
 * Whether this tick should capture and send a snapshot.
 *
 * A capture is skipped whenever the conversation is busy: a typed or spoken
 * turn is in flight, the avatar is thinking or speaking, a paused turn is
 * waiting for the person, or voice mode is holding capture during barge-in.
 * The tab being hidden is deliberately NOT a reason to skip: watching a shared
 * screen while the person works in another window is the main use.
 *
 * @param {Object} conditions
 * @param {boolean} conditions.enabled Ambient vision is running (see
 *   `isAmbientVisionActive`) on a surface that may send a snapshot.
 * @param {boolean} conditions.hasWebcam A webcam stream is live.
 * @param {boolean} conditions.hasScreen A screen stream is live.
 * @param {boolean} conditions.inFlight An observation is already being sent.
 * @param {number} conditions.pendingSendCount Turns in flight from the composer.
 * @param {string|null} conditions.assistantActivity What the avatar is doing.
 * @param {Object|null} conditions.pendingInterrupt A paused turn, if any.
 * @param {boolean} conditions.ambientHold Voice mode is listening or speaking.
 * @param {number|null} conditions.lastCaptureAt When the last capture started.
 * @param {number} conditions.intervalMs The configured interval.
 * @param {number|null} conditions.retryAfterUntil A server-imposed wait.
 * @param {number} conditions.now The current time.
 * @returns {boolean}
 */
export function shouldCaptureNow({
  enabled,
  hasWebcam,
  hasScreen,
  inFlight,
  pendingSendCount,
  assistantActivity,
  pendingInterrupt,
  ambientHold,
  lastCaptureAt,
  intervalMs,
  retryAfterUntil,
  now,
}) {
  if (!enabled) return false;
  if (!hasWebcam && !hasScreen) return false;
  if (inFlight) return false;
  if ((pendingSendCount ?? 0) > 0) return false;
  if (assistantActivity) return false;
  if (pendingInterrupt) return false;
  if (ambientHold) return false;
  if (retryAfterUntil && now < retryAfterUntil) return false;
  if (lastCaptureAt != null && now - lastCaptureAt < intervalMs) return false;
  return true;
}

/**
 * Milliseconds until the next capture is due (0 when due now).
 *
 * @param {Object} timing
 * @param {number|null} timing.lastCaptureAt When the last capture started.
 * @param {number} timing.intervalMs The configured interval.
 * @param {number|null} [timing.retryAfterUntil] A server-imposed wait.
 * @param {number} timing.now The current time.
 * @returns {number}
 */
export function nextCaptureInMs({ lastCaptureAt, intervalMs, retryAfterUntil, now }) {
  const dueAt = Math.max(
    lastCaptureAt == null ? now : lastCaptureAt + intervalMs,
    retryAfterUntil ?? 0
  );
  return Math.max(0, dueAt - now);
}

/**
 * Fold one event of an observation into the status the interface shows.
 *
 * Events: `capture_started` (with `at`), `ambient_decision` (the server's
 * triage frame), `done`, `failed` (with `error` and optional `retryAfterMs`),
 * and `reset`.
 *
 * @param {Object} status The current status.
 * @param {Object} event The event.
 * @returns {Object} The next status.
 */
export function reduceAmbientEvent(status, event) {
  const current = status ?? INITIAL_AMBIENT_STATUS;
  switch (event?.type) {
    case 'capture_started':
      return { ...current, inFlight: true, lastCapturedAt: event.at ?? Date.now(), lastError: null };
    case 'ambient_decision':
      return {
        ...current,
        lastDecision: event.decision ?? null,
        lastSummary: event.summary ?? null,
        lastObservationId: event.observation_id ?? null,
      };
    case 'done':
      return { ...current, inFlight: false, consecutiveFailures: 0, retryAfterUntil: null };
    case 'failed': {
      const failures = current.consecutiveFailures + 1;
      const retryAfterUntil =
        event.retryAfterMs != null ? (event.at ?? Date.now()) + event.retryAfterMs : null;
      return {
        ...current,
        inFlight: false,
        lastError: event.error ?? 'The observation could not be sent.',
        // A rate limit is the server pacing the client, not a failure of the
        // observation itself; it does not count toward switching capture off.
        consecutiveFailures: event.retryAfterMs != null ? current.consecutiveFailures : failures,
        retryAfterUntil,
      };
    }
    case 'reset':
      return { ...INITIAL_AMBIENT_STATUS };
    default:
      return current;
  }
}

/**
 * Whether this failure is the one that tells the person about an outage.
 *
 * Capture never switches itself off — there is no switch — so the outage is
 * reported once, when the failures reach the limit, and not again until an
 * observation has gone through and the count has started over.
 *
 * @param {Object} status The status after the failure was folded in.
 * @returns {boolean}
 */
export function shouldReportRepeatedFailures(status) {
  return (status?.consecutiveFailures ?? 0) === AMBIENT_FAILURE_LIMIT;
}

/** How long to wait after the server said the conversation was busy (409). */
export const BUSY_THREAD_RETRY_MS = 5_000;

/** How long to wait after the server rate-limited the client (429). */
export const RATE_LIMIT_RETRY_MS = 15_000;

/**
 * Read the seconds the server asked the client to wait, from an API error.
 *
 * Two answers pace the client rather than fail the observation: a 429 (the
 * per-thread floor) and a 409 (another turn — the person's own message — is
 * in flight on the conversation, and the observation was skipped for it).
 *
 * @param {Object} error The thrown error (an ApiError or anything else).
 * @returns {number|null} Milliseconds to wait, or null when the error was
 *   neither a rate limit nor a busy conversation.
 */
/**
 * The Retry-After the server sent, in milliseconds.
 *
 * @param {Object} error An API error that may carry headers.
 * @returns {number|null}
 */
export function readRetryAfterHeaderMs(error) {
  const headerValue =
    error?.headers?.get?.('retry-after') ??
    error?.headers?.['retry-after'] ??
    error?.retryAfter ??
    null;
  const seconds = Number.parseFloat(String(headerValue ?? '').trim());
  if (Number.isFinite(seconds) && seconds > 0) return Math.round(seconds * 1000);
  return null;
}

export function retryAfterMillisecondsFromError(error) {
  if (!error || (error.status !== 429 && error.status !== 409)) return null;
  const fromHeader = readRetryAfterHeaderMs(error);
  if (fromHeader != null) return fromHeader;
  return error.status === 409 ? BUSY_THREAD_RETRY_MS : RATE_LIMIT_RETRY_MS;
}

/**
 * Whether an observation ended because the person's own turn took the thread.
 *
 * A typed or spoken message stops any observation still in flight (the fetch
 * is aborted, or the server ends the stream with a stopped `done`). That is
 * the observation yielding, not failing: the status goes back to idle and no
 * failure is counted.
 *
 * @param {Object} error The thrown error.
 * @returns {boolean}
 */
export function isObservationYield(error) {
  return error?.name === 'AbortError';
}

/**
 * The short label shown beside the eye toggle.
 *
 * @param {Object} status The current status.
 * @param {number} nextInMs Milliseconds until the next capture.
 * @returns {string}
 */
export function describeAmbientStatus(status, nextInMs) {
  if (!status) return '';
  if (status.inFlight) return 'Looking…';
  if (status.lastError && status.consecutiveFailures > 0) return 'Could not send';
  if (status.lastDecision) {
    const label =
      status.lastDecision === 'respond'
        ? 'Spoke up'
        : status.lastDecision === 'notify'
          ? 'Heads-up sent'
          : 'Noticed quietly';
    const seconds = Math.ceil(nextInMs / 1000);
    return seconds > 0 ? `${label} · next in ${seconds}s` : label;
  }
  const seconds = Math.ceil(nextInMs / 1000);
  return seconds > 0 ? `First look in ${seconds}s` : 'Looking…';
}

// --- Whether a captured frame is worth sending at all -----------------------
//
// A webcam pointed at a person who is sitting still produces the same picture
// every interval. Sending it costs a description call and a triage call, and
// asks the avatar to judge a scene it has already judged. Neither buys the
// person anything: nothing happened, so there is nothing to say. These helpers
// let the capture loop drop an unchanged frame before it ever leaves the
// browser.
//
// The pixel work stays in the caller: this half takes plain arrays so the Node
// test runner can exercise it without a canvas.

/** Edge length of the thumbnail a frame is reduced to before comparison. */
export const AMBIENT_FRAME_SIGNATURE_EDGE = 32;

/**
 * Reduce one RGBA thumbnail to a grayscale signature.
 *
 * @param {Uint8ClampedArray|number[]} rgbaPixels Four bytes per pixel.
 * @returns {Uint8Array} One byte of brightness per pixel.
 */
export function frameSignatureFromPixels(rgbaPixels) {
  const pixelCount = Math.floor((rgbaPixels?.length ?? 0) / 4);
  const signature = new Uint8Array(pixelCount);
  for (let index = 0; index < pixelCount; index += 1) {
    const offset = index * 4;
    // Rec. 601 luma: brightness the eye actually weights, so a colour shift
    // that leaves the scene looking identical does not read as a change.
    signature[index] = Math.round(
      0.299 * rgbaPixels[offset] +
        0.587 * rgbaPixels[offset + 1] +
        0.114 * rgbaPixels[offset + 2]
    );
  }
  return signature;
}

/**
 * How much two frame signatures differ, from 0 (identical) to 1 (opposite).
 *
 * @param {Uint8Array|number[]|null} previous
 * @param {Uint8Array|number[]|null} next
 * @returns {number} Mean absolute difference, normalized to 0..1.
 */
export function frameDifference(previous, next) {
  if (!previous || !next || previous.length === 0) return 1;
  if (previous.length !== next.length) return 1;
  let total = 0;
  for (let index = 0; index < next.length; index += 1) {
    total += Math.abs(next[index] - previous[index]);
  }
  return total / next.length / 255;
}

/**
 * Whether a frame changed enough since the last one sent to be worth sending.
 *
 * With no previous frame the answer is always yes: the first look at a share
 * is what gives the avatar its context.
 *
 * @param {Object} comparison
 * @param {Uint8Array|number[]|null} comparison.previous The last frame SENT,
 *   not the last one captured, so that a scene drifting slowly still trips the
 *   threshold once it has drifted far enough.
 * @param {Uint8Array|number[]|null} comparison.next The frame just captured.
 * @param {number} comparison.threshold Mean difference, 0..1, to count as a change.
 * @returns {boolean}
 */
export function isFrameMateriallyDifferent({ previous, next, threshold }) {
  if (!next || next.length === 0) return false;
  if (!previous) return true;
  return frameDifference(previous, next) >= threshold;
}

/**
 * Whether a captured frame should be sent: it changed, or the quiet has run long.
 *
 * The heartbeat exists so an unchanging scene still reaches the avatar
 * occasionally. A heartbeat frame is context, never a message: it is triaged
 * like any other observation, and an unchanged scene carries no intent for the
 * avatar to answer, so it is noticed silently.
 *
 * @param {Object} decision
 * @param {Uint8Array|number[]|null} decision.previousSignature
 * @param {Uint8Array|number[]|null} decision.nextSignature
 * @param {number} decision.threshold
 * @param {number|null} decision.lastSentAt When a frame was last actually sent.
 * @param {number} decision.heartbeatMs How long a quiet scene may go unsent.
 * @param {number} decision.now
 * @returns {boolean}
 */
export function shouldSendCapturedFrame({
  previousSignature,
  nextSignature,
  threshold,
  lastSentAt,
  heartbeatMs,
  now,
}) {
  if (!nextSignature || nextSignature.length === 0) return false;
  if (
    isFrameMateriallyDifferent({
      previous: previousSignature,
      next: nextSignature,
      threshold,
    })
  ) {
    return true;
  }
  if (!heartbeatMs || heartbeatMs <= 0) return false;
  if (lastSentAt == null) return true;
  return now - lastSentAt >= heartbeatMs;
}
