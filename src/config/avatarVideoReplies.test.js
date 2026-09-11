import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  readAvatarVideoReplies,
  writeAvatarVideoReplies,
} from './avatarVideoReplies.js';

function memoryStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key)
        ? store[key]
        : null;
    },
    setItem(key, value) {
      store[key] = String(value);
    },
    removeItem(key) {
      delete store[key];
    },
  };
}

test('lip-synced video replies start off', () => {
  assert.equal(readAvatarVideoReplies('maya', memoryStorage()), false);
  assert.equal(readAvatarVideoReplies('maya', null), false);
  assert.equal(readAvatarVideoReplies('', memoryStorage()), false);
});

test('each avatar keeps its own lip-sync replies choice', () => {
  const storage = memoryStorage();
  writeAvatarVideoReplies('maya', true, storage);
  writeAvatarVideoReplies('evan', false, storage);

  assert.equal(readAvatarVideoReplies('maya', storage), true);
  assert.equal(readAvatarVideoReplies('evan', storage), false);
  assert.equal(readAvatarVideoReplies('other', storage), false);
});

test('turning lip-sync replies off does not erase another avatar', () => {
  const storage = memoryStorage();
  writeAvatarVideoReplies('maya', true, storage);
  writeAvatarVideoReplies('evan', true, storage);
  writeAvatarVideoReplies('maya', false, storage);

  assert.equal(readAvatarVideoReplies('maya', storage), false);
  assert.equal(readAvatarVideoReplies('evan', storage), true);
});
