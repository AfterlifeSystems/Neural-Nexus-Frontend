import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AMBIENT_FAILURE_LIMIT,
  INITIAL_AMBIENT_STATUS,
  describeAmbientStatus,
  isAmbientVisionActive,
  nextCaptureInMs,
  reduceAmbientEvent,
  retryAfterMillisecondsFromError,
  shouldCaptureNow,
  shouldReportRepeatedFailures,
} from './ambientCaptureScheduler.js';

const readyConditions = () => ({
  enabled: true,
  hasWebcam: true,
  hasScreen: false,
  inFlight: false,
  pendingSendCount: 0,
  assistantActivity: null,
  pendingInterrupt: null,
  ambientHold: false,
  lastCaptureAt: null,
  intervalMs: 30_000,
  retryAfterUntil: null,
  now: 100_000,
});

test('sharing a webcam or a screen starts ambient vision without a button', () => {
  assert.equal(isAmbientVisionActive({ allowed: true, hasWebcam: true, hasScreen: false }), true);
  assert.equal(isAmbientVisionActive({ allowed: true, hasWebcam: false, hasScreen: true }), true);
});

test('ambient vision stops only when no share is live or the account may not run it', () => {
  assert.equal(isAmbientVisionActive({ allowed: true, hasWebcam: false, hasScreen: false }), false);
  assert.equal(isAmbientVisionActive({ allowed: false, hasWebcam: true, hasScreen: true }), false);
});

test('a quiet conversation with a live share captures on the first tick', () => {
  assert.equal(shouldCaptureNow(readyConditions()), true);
  assert.equal(shouldCaptureNow({ ...readyConditions(), hasWebcam: false, hasScreen: true }), true);
});

test('capture waits for the interval and for a server-imposed pause', () => {
  assert.equal(shouldCaptureNow({ ...readyConditions(), lastCaptureAt: 80_000 }), false);
  assert.equal(shouldCaptureNow({ ...readyConditions(), lastCaptureAt: 70_000 }), true);
  assert.equal(shouldCaptureNow({ ...readyConditions(), retryAfterUntil: 100_500 }), false);
  assert.equal(shouldCaptureNow({ ...readyConditions(), retryAfterUntil: 99_500 }), true);
});

test('capture never interrupts a busy conversation', () => {
  assert.equal(shouldCaptureNow({ ...readyConditions(), enabled: false }), false);
  assert.equal(shouldCaptureNow({ ...readyConditions(), hasWebcam: false }), false);
  assert.equal(shouldCaptureNow({ ...readyConditions(), inFlight: true }), false);
  assert.equal(shouldCaptureNow({ ...readyConditions(), pendingSendCount: 1 }), false);
  assert.equal(shouldCaptureNow({ ...readyConditions(), assistantActivity: 'Thinking' }), false);
  assert.equal(shouldCaptureNow({ ...readyConditions(), pendingInterrupt: { sequence: 1 } }), false);
  assert.equal(shouldCaptureNow({ ...readyConditions(), ambientHold: true }), false);
});

test('the countdown reports when the next capture is due', () => {
  assert.equal(nextCaptureInMs({ lastCaptureAt: null, intervalMs: 30_000, now: 5 }), 0);
  assert.equal(nextCaptureInMs({ lastCaptureAt: 100, intervalMs: 30_000, now: 10_100 }), 20_000);
  assert.equal(
    nextCaptureInMs({ lastCaptureAt: 100, intervalMs: 30_000, retryAfterUntil: 50_000, now: 10_100 }),
    39_900
  );
});

test('the status follows an observation from capture to decision to done', () => {
  let status = reduceAmbientEvent(INITIAL_AMBIENT_STATUS, { type: 'capture_started', at: 10 });
  assert.equal(status.inFlight, true);
  assert.equal(status.lastCapturedAt, 10);
  status = reduceAmbientEvent(status, {
    type: 'ambient_decision',
    decision: 'notify',
    summary: 'An error dialog is open.',
    observation_id: 'obs-1',
  });
  assert.equal(status.lastDecision, 'notify');
  assert.equal(status.lastSummary, 'An error dialog is open.');
  assert.equal(status.lastObservationId, 'obs-1');
  status = reduceAmbientEvent(status, { type: 'done' });
  assert.equal(status.inFlight, false);
  assert.equal(status.consecutiveFailures, 0);
});

test('failures count up and a rate limit only paces the client', () => {
  let status = INITIAL_AMBIENT_STATUS;
  for (let attempt = 0; attempt < AMBIENT_FAILURE_LIMIT; attempt += 1) {
    assert.equal(shouldReportRepeatedFailures(status), false);
    status = reduceAmbientEvent(status, { type: 'failed', error: 'boom' });
  }
  assert.equal(shouldReportRepeatedFailures(status), true);
  // The outage is reported once; capture keeps going, so a further failure
  // does not report again until an observation has gone through.
  status = reduceAmbientEvent(status, { type: 'failed', error: 'boom' });
  assert.equal(shouldReportRepeatedFailures(status), false);
  const paced = reduceAmbientEvent(INITIAL_AMBIENT_STATUS, {
    type: 'failed',
    error: 'slow down',
    retryAfterMs: 12_000,
    at: 1_000,
  });
  assert.equal(paced.consecutiveFailures, 0);
  assert.equal(paced.retryAfterUntil, 13_000);
  assert.deepEqual(reduceAmbientEvent(paced, { type: 'reset' }), INITIAL_AMBIENT_STATUS);
  assert.equal(reduceAmbientEvent(paced, { type: 'unknown' }), paced);
});

test('a 429 error yields its Retry-After in milliseconds', () => {
  assert.equal(retryAfterMillisecondsFromError({ status: 500 }), null);
  assert.equal(retryAfterMillisecondsFromError(null), null);
  assert.equal(retryAfterMillisecondsFromError({ status: 429 }), 15_000);
  assert.equal(
    retryAfterMillisecondsFromError({ status: 429, headers: { 'retry-after': '7' } }),
    7_000
  );
  assert.equal(
    retryAfterMillisecondsFromError({ status: 429, headers: new Map([['retry-after', '3']]) }),
    3_000
  );
});

test('the status label says what happened last and when the next look is', () => {
  assert.equal(describeAmbientStatus(INITIAL_AMBIENT_STATUS, 0), 'Looking…');
  assert.equal(describeAmbientStatus(INITIAL_AMBIENT_STATUS, 4_200), 'First look in 5s');
  assert.equal(describeAmbientStatus({ ...INITIAL_AMBIENT_STATUS, inFlight: true }, 0), 'Looking…');
  assert.equal(
    describeAmbientStatus({ ...INITIAL_AMBIENT_STATUS, lastDecision: 'ignore' }, 9_000),
    'Noticed quietly · next in 9s'
  );
  assert.equal(
    describeAmbientStatus({ ...INITIAL_AMBIENT_STATUS, lastDecision: 'respond' }, 0),
    'Spoke up'
  );
  assert.equal(
    describeAmbientStatus({ ...INITIAL_AMBIENT_STATUS, lastDecision: 'notify' }, 1_000),
    'Heads-up sent · next in 1s'
  );
  assert.equal(
    describeAmbientStatus(
      { ...INITIAL_AMBIENT_STATUS, lastError: 'x', consecutiveFailures: 1 },
      1_000
    ),
    'Could not send'
  );
});
