import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_AMBIENT_FRAME_CHANGE_THRESHOLD,
  DEFAULT_AMBIENT_QUIET_HEARTBEAT_SECONDS,
  ambientFrameChangeThreshold,
  ambientQuietHeartbeatMilliseconds,
} from './ambientFrameChange.js';

test('a missing or unusable threshold falls back to the default', () => {
  for (const rawValue of [undefined, null, '', '  ', 'soon', '0', '-0.2', '1.5']) {
    assert.equal(
      ambientFrameChangeThreshold(rawValue),
      DEFAULT_AMBIENT_FRAME_CHANGE_THRESHOLD
    );
  }
});

test('a usable threshold is read as given', () => {
  assert.equal(ambientFrameChangeThreshold('0.08'), 0.08);
  assert.equal(ambientFrameChangeThreshold(1), 1);
});

test('the heartbeat is read in seconds and returned in milliseconds', () => {
  assert.equal(ambientQuietHeartbeatMilliseconds('120'), 120_000);
  assert.equal(
    ambientQuietHeartbeatMilliseconds(undefined),
    DEFAULT_AMBIENT_QUIET_HEARTBEAT_SECONDS * 1000
  );
});

test('an explicit zero turns the heartbeat off', () => {
  assert.equal(ambientQuietHeartbeatMilliseconds('0'), 0);
  assert.equal(ambientQuietHeartbeatMilliseconds(0), 0);
});
