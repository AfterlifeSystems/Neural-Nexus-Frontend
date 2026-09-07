import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MAX_RATE_LIMIT_RETRY_WAIT_MS,
  TRANSCRIBE_RATE_LIMIT_FALLBACK_MS,
  waitMsForRateLimitRetry,
  withRateLimitRetry,
} from './retryRateLimited.js';

test('only a 429 or 409 is retried', () => {
  assert.equal(waitMsForRateLimitRetry({ status: 500 }), null);
  assert.equal(waitMsForRateLimitRetry(null), null);
  assert.equal(
    waitMsForRateLimitRetry({ status: 429 }),
    TRANSCRIBE_RATE_LIMIT_FALLBACK_MS
  );
  assert.equal(waitMsForRateLimitRetry({ status: 409 }), 5_000);
});

test('Retry-After is honoured and capped', () => {
  assert.equal(
    waitMsForRateLimitRetry({ status: 429, headers: { 'retry-after': '3' } }),
    3_000
  );
  assert.equal(
    waitMsForRateLimitRetry({ status: 429, headers: { 'retry-after': '30' } }),
    MAX_RATE_LIMIT_RETRY_WAIT_MS
  );
});

test('a 429 is retried until it succeeds', async () => {
  let attempts = 0;
  const result = await withRateLimitRetry(async () => {
    attempts += 1;
    if (attempts < 3) {
      const error = new Error('slow down');
      error.status = 429;
      throw error;
    }
    return 'heard';
  }, { fallbackWaitMs: 1 });
  assert.equal(result, 'heard');
  assert.equal(attempts, 3);
});

test('a non-rate-limit error is not retried', async () => {
  let attempts = 0;
  await assert.rejects(
    () =>
      withRateLimitRetry(async () => {
        attempts += 1;
        const error = new Error('boom');
        error.status = 500;
        throw error;
      }),
    { status: 500 }
  );
  assert.equal(attempts, 1);
});
