// src/services/mediaJobFollow.js
//
// The pieces of following an identity-media job that do not touch the API
// client: one pass over the progress stream with a stall watchdog, and the
// server check that decides what a dropped stream meant. Kept apart from
// identityMediaJobs.js so they can be exercised under node without the
// React-bound modules that file imports.

import {
  applyMediaProgress,
  mergeUploadItems,
  titleFromUploadItems,
} from './mediaProcessSteps.js';
import {
  patchIdentityMediaJob,
  scheduleIdentityMediaJobDismiss,
} from './identityMediaJobStore.js';
import {
  MEDIA_JOB_STALL_TIMEOUT_MS,
  mergeMediaJobTiming,
  timingFromMediaJobFrame,
} from './mediaJobTiming.js';

export const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export const recordTimingFrame = (localId, frame) => {
  const timing = timingFromMediaJobFrame(frame);
  if (!timing) return;
  patchIdentityMediaJob(localId, (current) => ({
    ...current,
    timing: mergeMediaJobTiming(current.timing ?? null, timing),
  }));
};

export const failIdentityMediaJob = (localId, message) => {
  patchIdentityMediaJob(localId, (current) => ({
    ...current,
    status: 'error',
    error: message,
    cancelling: false,
    steps: current.steps.map((step) =>
      step.state === 'active' ? { ...step, state: 'error' } : step
    ),
  }));
};

export const cancelIdentityMediaJobCard = (localId) => {
  patchIdentityMediaJob(localId, (current) => ({
    ...current,
    status: 'cancelled',
    cancelling: false,
  }));
  scheduleIdentityMediaJobDismiss(localId);
};

/**
 * Open the progress stream once and report how it ended.
 *
 * The stream is expected to end with a `done` frame. Ending without one —
 * the socket closed, or no frame (not even a keep-alive) arrived for
 * MEDIA_JOB_STALL_TIMEOUT_MS — means the connection was lost, not that the
 * job finished; the caller then asks the server what became of the job.
 *
 * @returns {Promise<{ended: 'done'|'dropped', doneFrame: Object|null, error: Error|null}>}
 */
export const streamMediaJobOnce = async ({
  localId,
  jobId,
  streamJob,
  userSignal,
  stallTimeoutMs = MEDIA_JOB_STALL_TIMEOUT_MS,
}) => {
  const streamController = new AbortController();
  let stalled = false;
  const abortStream = () => streamController.abort();
  userSignal.addEventListener('abort', abortStream);

  let watchdog = null;
  const armWatchdog = () => {
    if (watchdog) clearTimeout(watchdog);
    watchdog = setTimeout(() => {
      stalled = true;
      streamController.abort();
    }, stallTimeoutMs);
  };

  let doneFrame = null;
  try {
    armWatchdog();
    await streamJob(
      jobId,
      (progressEvent) => {
        armWatchdog();
        recordTimingFrame(localId, progressEvent);
        if (progressEvent.type === 'media_progress') {
          patchIdentityMediaJob(localId, (current) => {
            const steps = current.steps.map((step) => ({ ...step }));
            applyMediaProgress(steps, progressEvent);
            const items = mergeUploadItems(current.items, progressEvent);
            return {
              ...current,
              steps,
              items,
              title: titleFromUploadItems(items, current.title),
            };
          });
        } else if (progressEvent.type === 'done') {
          doneFrame = progressEvent;
        }
      },
      streamController.signal
    );
    return { ended: doneFrame ? 'done' : 'dropped', doneFrame, error: null };
  } catch (streamError) {
    if (userSignal.aborted) throw streamError;
    if (stalled || streamError?.name === 'AbortError') {
      return { ended: 'dropped', doneFrame: null, error: null };
    }
    return { ended: 'dropped', doneFrame: null, error: streamError };
  } finally {
    if (watchdog) clearTimeout(watchdog);
    userSignal.removeEventListener('abort', abortStream);
  }
};

/**
 * Ask the server what became of a job whose stream dropped.
 *
 * @returns {Promise<'lost'|'unreachable'|'running'|'completed'|'error'|'cancelled'>}
 */
export const checkMediaJobOnServer = async ({ localId, jobId, getJob }) => {
  let snapshot;
  try {
    snapshot = await getJob(jobId);
  } catch (lookupError) {
    if (lookupError?.status === 404) return 'lost';
    return 'unreachable';
  }
  recordTimingFrame(localId, snapshot);
  const status = String(snapshot?.status ?? '').toLowerCase();
  if (status === 'completed' || status === 'done' || status === 'success') {
    return snapshot?.error ? 'error' : 'completed';
  }
  if (status === 'error' || status === 'failed') {
    patchIdentityMediaJob(localId, (current) => ({
      ...current,
      error: snapshot?.error || current.error,
    }));
    return 'error';
  }
  if (status === 'cancelled' || status === 'canceled') return 'cancelled';
  return 'running';
};
