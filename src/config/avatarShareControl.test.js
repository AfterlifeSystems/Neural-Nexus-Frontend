import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  readAvatarShareControl,
  readAvatarShareControlStore,
  writeAvatarShareControl,
  subscribeAvatarShareControl,
} from './avatarShareControl.js';

function fakeStorage(initial = {}) {
  let value = initial.value ?? null;
  return {
    getItem: () => value,
    setItem: (_key, next) => {
      if (initial.refuse) throw new Error('quota');
      value = next;
    },
    read: () => value,
  };
}

test('an avatar nobody has decided about may not open the camera', () => {
  const storage = fakeStorage();
  assert.equal(readAvatarShareControl('avatar-1', storage), false);
});

test('the permission is remembered per avatar', () => {
  const storage = fakeStorage();
  writeAvatarShareControl('avatar-1', true, storage);
  assert.equal(readAvatarShareControl('avatar-1', storage), true);
  assert.equal(readAvatarShareControl('avatar-2', storage), false);
});

test('turning the permission off is remembered too', () => {
  const storage = fakeStorage();
  writeAvatarShareControl('avatar-1', true, storage);
  writeAvatarShareControl('avatar-1', false, storage);
  assert.equal(readAvatarShareControl('avatar-1', storage), false);
});

test('granting one avatar leaves the others alone', () => {
  const storage = fakeStorage();
  writeAvatarShareControl('avatar-1', true, storage);
  writeAvatarShareControl('avatar-2', true, storage);
  writeAvatarShareControl('avatar-1', false, storage);
  assert.equal(readAvatarShareControl('avatar-2', storage), true);
});

test('an entry written in the object shape still reads as the camera', () => {
  // A short-lived version of this setting wrote `{camera, desktop}`. Both
  // shapes only ever meant the camera.
  const storage = fakeStorage({
    value: JSON.stringify({ 'avatar-1': { camera: true, desktop: true } }),
  });
  assert.equal(readAvatarShareControl('avatar-1', storage), true);
});

test('a missing avatar id is never treated as permitted', () => {
  const storage = fakeStorage();
  writeAvatarShareControl('', true, storage);
  assert.equal(readAvatarShareControl('', storage), false);
  assert.equal(readAvatarShareControl(null, storage), false);
  assert.equal(readAvatarShareControl(undefined, storage), false);
});

test('unreadable storage reads as not permitted rather than throwing', () => {
  const broken = {
    getItem: () => {
      throw new Error('blocked');
    },
  };
  assert.deepEqual(readAvatarShareControlStore(broken), {});
  assert.equal(readAvatarShareControl('avatar-1', broken), false);
});

test('rubbish in storage reads as not permitted', () => {
  assert.deepEqual(readAvatarShareControlStore(fakeStorage({ value: '[]' })), {});
  assert.deepEqual(
    readAvatarShareControlStore(fakeStorage({ value: 'not json' })),
    {}
  );
});

test('storage that refuses to write does not fail the press', () => {
  const storage = fakeStorage({ refuse: true });
  assert.equal(writeAvatarShareControl('avatar-1', true, storage), true);
});

test('a change is announced to whoever is listening', () => {
  const storage = fakeStorage();
  const heard = [];
  const unsubscribe = subscribeAvatarShareControl((id, allowed) =>
    heard.push([id, allowed])
  );
  writeAvatarShareControl('avatar-1', true, storage);
  unsubscribe();
  writeAvatarShareControl('avatar-1', false, storage);
  assert.deepEqual(heard, [['avatar-1', true]]);
});
