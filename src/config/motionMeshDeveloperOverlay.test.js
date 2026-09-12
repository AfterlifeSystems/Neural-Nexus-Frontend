import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  readMotionMeshDeveloperOverlay,
  shouldDrawMotionMeshOverlay,
  shouldOfferMotionMeshDeveloperOption,
  subscribeMotionMeshDeveloperOverlay,
  writeMotionMeshDeveloperOverlay,
} from './motionMeshDeveloperOverlay.js';

function fakeStorage(initial = null) {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_key, next) => {
      value = next;
    },
  };
}

test('the option is offered only to the administrator in a development build', () => {
  assert.equal(
    shouldOfferMotionMeshDeveloperOption({ isDev: true, isAdmin: true }),
    true
  );
  assert.equal(
    shouldOfferMotionMeshDeveloperOption({ isDev: false, isAdmin: true }),
    false
  );
  assert.equal(
    shouldOfferMotionMeshDeveloperOption({ isDev: true, isAdmin: false }),
    false
  );
  assert.equal(shouldOfferMotionMeshDeveloperOption(), false);
});

test('the developer switch is off until switched on', () => {
  assert.equal(readMotionMeshDeveloperOverlay(fakeStorage()), false);
  assert.equal(readMotionMeshDeveloperOverlay(null), false);
  assert.equal(readMotionMeshDeveloperOverlay(fakeStorage('{')), false);
});

test('writeMotionMeshDeveloperOverlay stores the choice and tells listeners', () => {
  const storage = fakeStorage();
  const seen = [];
  const unsubscribe = subscribeMotionMeshDeveloperOverlay((shown) =>
    seen.push(shown)
  );
  assert.equal(writeMotionMeshDeveloperOverlay(true, storage), true);
  assert.equal(readMotionMeshDeveloperOverlay(storage), true);
  assert.equal(writeMotionMeshDeveloperOverlay(false, storage), false);
  assert.equal(readMotionMeshDeveloperOverlay(storage), false);
  unsubscribe();
  assert.deepEqual(seen, [true, false]);
});

test('the mesh is drawn only when offered, switched on, and not disabled by the deployment', () => {
  assert.equal(
    shouldDrawMotionMeshOverlay({ overlayEnabled: true, offered: true, shown: true }),
    true
  );
  // A stored switch left on does nothing for an account the option is not
  // offered to.
  assert.equal(
    shouldDrawMotionMeshOverlay({ overlayEnabled: true, offered: false, shown: true }),
    false
  );
  assert.equal(
    shouldDrawMotionMeshOverlay({ overlayEnabled: true, offered: true, shown: false }),
    false
  );
  assert.equal(
    shouldDrawMotionMeshOverlay({ overlayEnabled: false, offered: true, shown: true }),
    false
  );
  assert.equal(shouldDrawMotionMeshOverlay(), false);
});
