import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ambientCaptureIntervalMilliseconds,
  DEFAULT_AMBIENT_CAPTURE_INTERVAL_SECONDS,
  MINIMUM_AMBIENT_CAPTURE_INTERVAL_SECONDS,
} from './ambientCaptureInterval.js';

test('an unset or empty setting uses the default interval', () => {
  assert.equal(
    ambientCaptureIntervalMilliseconds(undefined),
    DEFAULT_AMBIENT_CAPTURE_INTERVAL_SECONDS * 1000
  );
  assert.equal(ambientCaptureIntervalMilliseconds(''), 30_000);
  assert.equal(ambientCaptureIntervalMilliseconds('   '), 30_000);
});

test('a numeric setting is honoured in seconds', () => {
  assert.equal(ambientCaptureIntervalMilliseconds('45'), 45_000);
  assert.equal(ambientCaptureIntervalMilliseconds(12.5), 12_500);
});

test('a value below the floor or not a number never speeds capture up', () => {
  assert.equal(
    ambientCaptureIntervalMilliseconds('1'),
    MINIMUM_AMBIENT_CAPTURE_INTERVAL_SECONDS * 1000
  );
  assert.equal(ambientCaptureIntervalMilliseconds('0'), 30_000);
  assert.equal(ambientCaptureIntervalMilliseconds('-3'), 30_000);
  assert.equal(ambientCaptureIntervalMilliseconds('fast'), 30_000);
});
