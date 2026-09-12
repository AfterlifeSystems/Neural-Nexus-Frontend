import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AVATAR_ICON_KEY_PREFIX,
  LAST_AVATAR_ICON_STORAGE_KEY,
  forgetCachedAvatarIcon,
  forgetCachedAvatarIconsExcept,
  isQuotaExceededError,
  readCachedAvatarIcons,
  writeCachedAvatarIcon,
} from './avatarIconCache.js';

function memoryStorage(initial = {}) {
  const store = { ...initial };
  return {
    get length() {
      return Object.keys(store).length;
    },
    key(index) {
      return Object.keys(store)[index] ?? null;
    },
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
    snapshot() {
      return { ...store };
    },
  };
}

function quotaExceeded() {
  const error = new Error('The quota has been exceeded.');
  error.name = 'QuotaExceededError';
  error.code = 22;
  return error;
}

function quotaStorage(budget, initial = {}) {
  const store = { ...initial };
  const usedBytes = () =>
    Object.values(store).reduce((total, value) => total + String(value).length, 0);
  return {
    get length() {
      return Object.keys(store).length;
    },
    key(index) {
      return Object.keys(store)[index] ?? null;
    },
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key)
        ? store[key]
        : null;
    },
    setItem(key, value) {
      const next = String(value);
      const withoutCurrent = usedBytes() - (store[key]?.length ?? 0);
      if (withoutCurrent + next.length > budget) {
        throw quotaExceeded();
      }
      store[key] = next;
    },
    removeItem(key) {
      delete store[key];
    },
    snapshot() {
      return { ...store };
    },
  };
}

test('a written portrait is readable on the next visit', () => {
  const storage = memoryStorage();
  writeCachedAvatarIcon('avatar-1', 'data:image/png;base64,aaa', storage);
  assert.deepEqual(readCachedAvatarIcons(storage), {
    'avatar-1': 'data:image/png;base64,aaa',
  });
});

test('a leftover last-icon duplicate is dropped on read', () => {
  const storage = memoryStorage({
    [`${AVATAR_ICON_KEY_PREFIX}avatar-1`]: 'data:image/png;base64,keep',
    [LAST_AVATAR_ICON_STORAGE_KEY]: 'data:image/png;base64,duplicate',
  });
  const cached = readCachedAvatarIcons(storage);
  assert.deepEqual(cached, { 'avatar-1': 'data:image/png;base64,keep' });
  assert.equal(storage.getItem(LAST_AVATAR_ICON_STORAGE_KEY), null);
});

test('quota evicts the leftover last-icon first so the new portrait fits', () => {
  const storage = quotaStorage(12, {
    [LAST_AVATAR_ICON_STORAGE_KEY]: '0123456789ab',
  });
  writeCachedAvatarIcon('avatar-1', '0123456789ab', storage);
  assert.equal(
    storage.getItem(`${AVATAR_ICON_KEY_PREFIX}avatar-1`),
    '0123456789ab'
  );
  assert.equal(storage.getItem(LAST_AVATAR_ICON_STORAGE_KEY), null);
});

test('quota evicts the largest other portrait and keeps the new one', () => {
  const storage = quotaStorage(15, {
    [`${AVATAR_ICON_KEY_PREFIX}small`]: '12345',
    [`${AVATAR_ICON_KEY_PREFIX}large`]: '1234567890',
  });
  writeCachedAvatarIcon('fresh', 'ABCDEF', storage);
  const snapshot = storage.snapshot();
  assert.equal(snapshot[`${AVATAR_ICON_KEY_PREFIX}fresh`], 'ABCDEF');
  assert.equal(snapshot[`${AVATAR_ICON_KEY_PREFIX}large`], undefined);
  assert.equal(snapshot[`${AVATAR_ICON_KEY_PREFIX}small`], '12345');
});

test('a portrait that cannot fit even alone is skipped without throwing', () => {
  const storage = quotaStorage(4);
  writeCachedAvatarIcon('huge', '12345', storage);
  assert.deepEqual(storage.snapshot(), {});
});

test('portraits for avatars no longer in the live list are dropped', () => {
  const storage = memoryStorage({
    [`${AVATAR_ICON_KEY_PREFIX}keep`]: 'keep',
    [`${AVATAR_ICON_KEY_PREFIX}gone`]: 'gone',
    other_key: 'leave',
  });
  forgetCachedAvatarIconsExcept(['keep'], storage);
  assert.deepEqual(storage.snapshot(), {
    [`${AVATAR_ICON_KEY_PREFIX}keep`]: 'keep',
    other_key: 'leave',
  });
});

test('an empty keep-list does not wipe the cache', () => {
  const storage = memoryStorage({
    [`${AVATAR_ICON_KEY_PREFIX}keep`]: 'keep',
  });
  forgetCachedAvatarIconsExcept([], storage);
  forgetCachedAvatarIconsExcept([null, ''], storage);
  assert.equal(storage.getItem(`${AVATAR_ICON_KEY_PREFIX}keep`), 'keep');
});

test('forgetting one portrait leaves the others', () => {
  const storage = memoryStorage({
    [`${AVATAR_ICON_KEY_PREFIX}a`]: 'a',
    [`${AVATAR_ICON_KEY_PREFIX}b`]: 'b',
  });
  forgetCachedAvatarIcon('a', storage);
  assert.deepEqual(readCachedAvatarIcons(storage), { b: 'b' });
});

test('missing storage is a no-op', () => {
  writeCachedAvatarIcon('avatar-1', 'data:image/png;base64,aaa', null);
  assert.deepEqual(readCachedAvatarIcons(null), {});
  forgetCachedAvatarIcon('avatar-1', null);
  forgetCachedAvatarIconsExcept(['avatar-1'], null);
});

test('quota exceeded is recognised across browsers', () => {
  assert.equal(isQuotaExceededError(quotaExceeded()), true);
  const firefox = new Error('full');
  firefox.name = 'NS_ERROR_DOM_QUOTA_REACHED';
  firefox.code = 1014;
  assert.equal(isQuotaExceededError(firefox), true);
  assert.equal(isQuotaExceededError(new Error('blocked')), false);
});
