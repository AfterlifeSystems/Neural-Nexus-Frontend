import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  readSceneNarration,
  sceneNarrationFormValue,
  sceneNarrationFromFrame,
  subscribeSceneNarration,
  writeSceneNarration,
  clampNarrationSeconds,
  readSceneNarrationSeconds,
  writeSceneNarrationSeconds,
} from './sceneNarration.js';
import {
  DEFAULT_SCENE_NARRATION_HEARTBEAT_SECONDS,
  DEFAULT_SCENE_NARRATION_INTERVAL_SECONDS,
  sceneNarrationHeartbeatMilliseconds,
  sceneNarrationIntervalMilliseconds,
  MINIMUM_SCENE_NARRATION_INTERVAL_SECONDS,
  SCENE_NARRATION_PACE_OPTIONS,
  SLOWEST_SCENE_NARRATION_INTERVAL_SECONDS,
} from './sceneNarrationInterval.js';

function fakeStorage(initial = null) {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_key, next) => {
      value = next;
    },
  };
}

test('narration is off until somebody switches it on', () => {
  assert.equal(readSceneNarration(fakeStorage()), false);
  assert.equal(readSceneNarration(null), false);
});

test('a written switch is read back, in either stored shape', () => {
  const storage = fakeStorage();
  assert.equal(writeSceneNarration(true, storage), true);
  assert.equal(readSceneNarration(storage), true);
  writeSceneNarration(false, storage);
  assert.equal(readSceneNarration(storage), false);
  assert.equal(readSceneNarration(fakeStorage('true')), true);
  assert.equal(readSceneNarration(fakeStorage('{"enabled":true}')), true);
});

test('unreadable storage reads as off rather than throwing', () => {
  assert.equal(readSceneNarration(fakeStorage('{not json')), false);
  const refusing = {
    getItem: () => {
      throw new Error('denied');
    },
    setItem: () => {
      throw new Error('denied');
    },
  };
  assert.equal(readSceneNarration(refusing), false);
  // The choice still takes effect for this page: listeners are told.
  const heard = [];
  const unsubscribe = subscribeSceneNarration((enabled) => heard.push(enabled));
  assert.equal(writeSceneNarration(true, refusing), true);
  unsubscribe();
  assert.deepEqual(heard, [true]);
});

test('listeners hear every write and can stop listening', () => {
  const storage = fakeStorage();
  const heard = [];
  const unsubscribe = subscribeSceneNarration((enabled) => heard.push(enabled));
  writeSceneNarration(true, storage);
  writeSceneNarration(false, storage);
  unsubscribe();
  writeSceneNarration(true, storage);
  assert.deepEqual(heard, [true, false]);
});

test('every turn reports the switch as on or off, never nothing', () => {
  assert.equal(sceneNarrationFormValue(true), 'on');
  assert.equal(sceneNarrationFormValue(false), 'off');
});

test("the avatar's frame is read, and other frames are not", () => {
  assert.deepEqual(
    sceneNarrationFromFrame({ type: 'scene_narration', enabled: true, reason: 'asked' }),
    { enabled: true, intervalSeconds: null, reason: 'asked' }
  );
  assert.deepEqual(
    sceneNarrationFromFrame({ type: 'scene_narration', enabled: 0 }),
    { enabled: false, intervalSeconds: null, reason: '' }
  );
  assert.equal(sceneNarrationFromFrame({ type: 'share_stop' }), null);
  assert.equal(sceneNarrationFromFrame(null), null);
});

test('the narration interval defaults, floors, and reads the environment', () => {
  assert.equal(
    sceneNarrationIntervalMilliseconds(undefined),
    DEFAULT_SCENE_NARRATION_INTERVAL_SECONDS * 1000
  );
  assert.equal(sceneNarrationIntervalMilliseconds('nonsense'), 5000);
  assert.equal(sceneNarrationIntervalMilliseconds('20'), 20000);
  // Faster than the API allows is slowed to the floor, not refused every tick.
  // The floor is narration's own, not ambient vision's: narration is allowed
  // to look far more often, and pacing it by the ambient floor had every
  // second look refused with 429.
  assert.equal(
    sceneNarrationIntervalMilliseconds('1'),
    MINIMUM_SCENE_NARRATION_INTERVAL_SECONDS * 1000
  );
  // Between the two floors is a real setting, not something to slow down.
  assert.equal(sceneNarrationIntervalMilliseconds('6'), 6000);
});

test('the narration heartbeat defaults, reads, and can be switched off', () => {
  assert.equal(
    sceneNarrationHeartbeatMilliseconds(undefined),
    DEFAULT_SCENE_NARRATION_HEARTBEAT_SECONDS * 1000
  );
  assert.equal(sceneNarrationHeartbeatMilliseconds('nonsense'), 45000);
  assert.equal(sceneNarrationHeartbeatMilliseconds('30'), 30000);
  assert.equal(sceneNarrationHeartbeatMilliseconds('0'), 0);
  assert.equal(sceneNarrationHeartbeatMilliseconds('-5'), 0);
});

// --- How often the scene is read out -----------------------------------------

test('a pace is stored, read back, and survives flipping the switch', () => {
  const storage = fakeStorage();
  writeSceneNarrationSeconds(30, storage);
  assert.equal(readSceneNarrationSeconds(storage), 30);
  // Switching the mode on and off must not silently reset a pace the person
  // chose; the two are independent settings in one record.
  writeSceneNarration(true, storage);
  assert.equal(readSceneNarrationSeconds(storage), 30);
  assert.equal(readSceneNarration(storage), true);
  writeSceneNarration(false, storage);
  assert.equal(readSceneNarrationSeconds(storage), 30);
});

test('every pace lands on one of the five offered, and none is refused', () => {
  // "Describe much more often" is a reasonable thing to say, and an error is
  // something a person listening to their phone cannot act on. Snapping also
  // keeps the avatar and the Accessibility page from ever disagreeing about
  // how often it is reading — every pace has a name the person can be told.
  assert.equal(
    clampNarrationSeconds(0.1),
    MINIMUM_SCENE_NARRATION_INTERVAL_SECONDS
  );
  assert.equal(
    clampNarrationSeconds(9999),
    SLOWEST_SCENE_NARRATION_INTERVAL_SECONDS
  );
  assert.equal(clampNarrationSeconds('nonsense'), 5);
  assert.equal(clampNarrationSeconds(null), 5);
  // Between two choices: the nearer one, never something in between.
  assert.equal(clampNarrationSeconds(12), 10);
  assert.equal(clampNarrationSeconds(22), 15);
  assert.equal(clampNarrationSeconds(45), 30);
  for (const option of SCENE_NARRATION_PACE_OPTIONS) {
    assert.equal(clampNarrationSeconds(option), option);
  }
});

test('a record written before the pace existed still reads', () => {
  const storage = fakeStorage();
  storage.setItem('scene_narration', JSON.stringify({ enabled: true }));
  assert.equal(readSceneNarration(storage), true);
  assert.equal(readSceneNarrationSeconds(storage), 5);
});

test('the avatar can change the pace, or leave it alone', () => {
  const changed = sceneNarrationFromFrame({
    type: 'scene_narration',
    enabled: true,
    every_seconds: 30,
  });
  assert.equal(changed.intervalSeconds, 30);
  // A pace the avatar names that is not one of the five becomes the nearer one.
  const snapped = sceneNarrationFromFrame({
    type: 'scene_narration',
    enabled: true,
    every_seconds: 8,
  });
  assert.equal(snapped.intervalSeconds, 10);
  // Asked only to start: the pace the person chose is not overwritten.
  const started = sceneNarrationFromFrame({
    type: 'scene_narration',
    enabled: true,
  });
  assert.equal(started.intervalSeconds, null);
  const clamped = sceneNarrationFromFrame({
    type: 'scene_narration',
    enabled: true,
    every_seconds: 0.5,
  });
  assert.equal(clamped.intervalSeconds, MINIMUM_SCENE_NARRATION_INTERVAL_SECONDS);
});

test('a pace change tells listeners, so every surface agrees', () => {
  const storage = fakeStorage();
  const heard = [];
  const stop = subscribeSceneNarration((enabled, intervalSeconds) =>
    heard.push([enabled, intervalSeconds])
  );
  writeSceneNarration(true, storage);
  writeSceneNarrationSeconds(30, storage);
  stop();
  assert.deepEqual(heard.at(-1), [true, 30]);
});
