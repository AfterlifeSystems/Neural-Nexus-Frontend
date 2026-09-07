// Retry a call the API refused with 429 or 409, honouring Retry-After.
//
// Live transcription and speaker-labelled turns share a meter with ambient
// looks. A single refusal is the server asking the client to wait, not a
// failed utterance — so the first answers are retried before anything is
// shown to the person.

import {
  BUSY_THREAD_RETRY_MS,
  readRetryAfterHeaderMs,
} from './ambientCaptureScheduler.js';

export const RATE_LIMIT_RETRY_ATTEMPTS = 3;
export const TRANSCRIBE_RATE_LIMIT_FALLBACK_MS = 2_000;
export const MAX_RATE_LIMIT_RETRY_WAIT_MS = 8_000;

/**
 * How long to wait before retrying this error, or null when it is not a
 * rate-limit / busy-thread answer.
 *
 * @param {Object} error
 * @param {number} [fallbackWaitMs] Used when the error is a 429 with no header.
 * @returns {number|null}
 */
export function waitMsForRateLimitRetry(
  error,
  { fallbackWaitMs = TRANSCRIBE_RATE_LIMIT_FALLBACK_MS } = {}
) {
  if (!error || (error.status !== 429 && error.status !== 409)) return null;
  const fromHeader = readRetryAfterHeaderMs(error);
  const raw =
    fromHeader ??
    (error.status === 409 ? BUSY_THREAD_RETRY_MS : fallbackWaitMs);
  return Math.min(raw, MAX_RATE_LIMIT_RETRY_WAIT_MS);
}

function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

/**
 * Run `task` again after a 429 or 409, then throw the last error.
 *
 * @template T
 * @param {() => Promise<T>} task
 * @param {Object} [options]
 * @param {number} [options.maxAttempts]
 * @param {number} [options.fallbackWaitMs]
 * @returns {Promise<T>}
 */
export async function withRateLimitRetry(task, options = {}) {
  const maxAttempts = options.maxAttempts ?? RATE_LIMIT_RETRY_ATTEMPTS;
  const fallbackWaitMs =
    options.fallbackWaitMs ?? TRANSCRIBE_RATE_LIMIT_FALLBACK_MS;
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      const waitMs = waitMsForRateLimitRetry(error, { fallbackWaitMs });
      if (waitMs == null || attempt === maxAttempts) throw error;
      await sleep(waitMs);
    }
  }
  throw lastError;
}
