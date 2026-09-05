import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  describeMediaJobTiming,
  elapsedSecondsNow,
  formatDurationEstimate,
  formatElapsedDuration,
  mergeMediaJobTiming,
  remainingSecondsNow,
  timingFromMediaJobFrame,
  timingFromMediaJobSnapshot,
} from './mediaJobTiming.js';

test('formatDurationEstimate rounds to friendly minutes and hours', () => {
  assert.equal(formatDurationEstimate(30), 'under a minute');
  assert.equal(formatDurationEstimate(90), 'about 2 min');
  assert.equal(formatDurationEstimate(2342), 'about 39 min');
  assert.equal(formatDurationEstimate(3600), 'about 1 h');
  assert.equal(formatDurationEstimate(3900), 'about 1 h 5 min');
  assert.equal(formatDurationEstimate(null), 'under a minute');
});

test('timingFromMediaJobFrame reads the API keys and ignores frames without timing', () => {
  const timing = timingFromMediaJobFrame(
    {
      type: 'keep_alive',
      started_at: 1_000,
      elapsed_seconds: 12.5,
      estimated_media_seconds: 2342,
      estimated_processing_seconds: 2342,
      estimated_remaining_seconds: 2329.5,
    },
    5_000
  );
  assert.deepEqual(timing, {
    estimatedProcessingSeconds: 2342,
    estimatedMediaSeconds: 2342,
    elapsedSeconds: 12.5,
    startedAtEpochSeconds: 1_000,
    durationSeconds: null,
    observedAtMs: 5_000,
  });
  assert.equal(timingFromMediaJobFrame({ type: 'media_progress', stage: 'x' }), null);
  assert.equal(timingFromMediaJobFrame(null), null);
});

test('timingFromMediaJobSnapshot derives elapsed time from started_at', () => {
  const nowMs = 1_000_000 * 1000;
  const running = timingFromMediaJobSnapshot(
    { status: 'running', started_at: 1_000_000 - 120, estimated_processing_seconds: 600 },
    nowMs
  );
  assert.equal(running.elapsedSeconds, 120);
  const finished = timingFromMediaJobSnapshot(
    { status: 'completed', started_at: 100, finished_at: 160, duration_seconds: 60 },
    nowMs
  );
  assert.equal(finished.elapsedSeconds, 60);
  assert.equal(finished.durationSeconds, 60);
});

test('mergeMediaJobTiming keeps the estimate and takes the newest elapsed time', () => {
  const first = timingFromMediaJobFrame(
    { estimated_processing_seconds: 600, elapsed_seconds: 1 },
    1_000
  );
  const later = timingFromMediaJobFrame({ elapsed_seconds: 30 }, 31_000);
  const merged = mergeMediaJobTiming(first, later);
  assert.equal(merged.estimatedProcessingSeconds, 600);
  assert.equal(merged.elapsedSeconds, 30);
  assert.equal(merged.observedAtMs, 31_000);
  assert.equal(mergeMediaJobTiming(null, null), null);
  assert.equal(mergeMediaJobTiming(first, null), first);
});

test('elapsed and remaining seconds keep moving between frames', () => {
  const timing = timingFromMediaJobFrame(
    { estimated_processing_seconds: 600, elapsed_seconds: 100 },
    10_000
  );
  assert.equal(elapsedSecondsNow(timing, 10_000), 100);
  assert.equal(elapsedSecondsNow(timing, 40_000), 130);
  assert.equal(remainingSecondsNow(timing, 40_000), 470);
  assert.equal(remainingSecondsNow(timing, 10_000_000), 0);
  assert.equal(remainingSecondsNow({ elapsedSeconds: 5, observedAtMs: 0 }, 1), null);
});

test('formatElapsedDuration counts seconds, then whole minutes and hours', () => {
  assert.equal(formatElapsedDuration(0), '0 s');
  assert.equal(formatElapsedDuration(45.9), '45 s');
  assert.equal(formatElapsedDuration(660), '11 min');
  assert.equal(formatElapsedDuration(3600), '1 h');
  assert.equal(formatElapsedDuration(3660), '1 h 1 min');
});

test('describeMediaJobTiming writes the card line for each state', () => {
  const timing = timingFromMediaJobFrame(
    { estimated_processing_seconds: 2342, elapsed_seconds: 660 },
    0
  );
  assert.equal(
    describeMediaJobTiming({ status: 'running', timing }, 0),
    'Running 11 min · about 39 min total · 28 min left'
  );
  assert.equal(
    describeMediaJobTiming({ status: 'running', timing }, 3_000_000),
    'Running 1 h 1 min · longer than the 39 min estimate'
  );
  // An estimate without any elapsed time (nothing observed yet) still reads.
  assert.equal(
    describeMediaJobTiming(
      { status: 'running', timing: { estimatedProcessingSeconds: 600 } },
      0
    ),
    'About 10 min total · 10 min left'
  );
  assert.equal(
    describeMediaJobTiming({
      status: 'success',
      timing: { ...timing, durationSeconds: 2460 },
    }),
    'Took 41 min'
  );
  assert.equal(describeMediaJobTiming({ status: 'running', timing: null }), null);
  // No estimate (a document, an image): the elapsed time alone.
  assert.equal(
    describeMediaJobTiming(
      { status: 'running', timing: { elapsedSeconds: 3, observedAtMs: 0 } },
      0
    ),
    'Running 3 s'
  );
  // A card started locally knows only when it began.
  assert.equal(
    describeMediaJobTiming(
      {
        status: 'running',
        timing: timingFromMediaJobFrame({ started_at: 1_000 }, 1_000_000),
      },
      1_000_000 + 125_000
    ),
    'Running 2 min'
  );
  assert.equal(describeMediaJobTiming({ status: 'error', timing }), null);
});
