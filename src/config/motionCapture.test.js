import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  readMotionCapture,
  shouldRunMotionCapture,
  subscribeMotionCapture,
  writeMotionCapture,
} from './motionCapture.js';

function fakeStorage(initial = null) {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_key, next) => {
      value = next;
    },
  };
}

test('motion capture is off until the person turns it on', () => {
  assert.equal(readMotionCapture(fakeStorage()), false);
  assert.equal(readMotionCapture(null), false);
  assert.equal(readMotionCapture(fakeStorage('not json')), false);
});

test('writeMotionCapture stores the choice and reads it back', () => {
  const storage = fakeStorage();
  assert.equal(writeMotionCapture(true, storage), true);
  assert.equal(readMotionCapture(storage), true);
  assert.equal(writeMotionCapture(false, storage), false);
  assert.equal(readMotionCapture(storage), false);
});

test('a bare boolean written by an older build still reads', () => {
  assert.equal(readMotionCapture(fakeStorage('true')), true);
  assert.equal(readMotionCapture(fakeStorage('false')), false);
});

test('a write without storage still tells listeners', () => {
  const seen = [];
  const unsubscribe = subscribeMotionCapture((enabled) => seen.push(enabled));
  writeMotionCapture(true, null);
  writeMotionCapture(false, null);
  unsubscribe();
  writeMotionCapture(true, null);
  assert.deepEqual(seen, [true, false]);
});

test('the landmarker runs only with the switch on and every other condition met', () => {
  const allMet = {
    captureEnabled: true,
    ambientAllowed: true,
    ambientCaptureAllowed: true,
    hasAvatar: true,
    cameraFacesPerson: true,
  };
  assert.equal(shouldRunMotionCapture(allMet), true);
  assert.equal(shouldRunMotionCapture({ ...allMet, captureEnabled: false }), false);
  assert.equal(shouldRunMotionCapture({ ...allMet, ambientAllowed: false }), false);
  assert.equal(
    shouldRunMotionCapture({ ...allMet, ambientCaptureAllowed: false }),
    false
  );
  assert.equal(shouldRunMotionCapture({ ...allMet, hasAvatar: false }), false);
  assert.equal(
    shouldRunMotionCapture({ ...allMet, cameraFacesPerson: false }),
    false
  );
  assert.equal(shouldRunMotionCapture(), false);
});
