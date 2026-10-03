import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  loadAccountHiddenCarouselAvatarIds,
  mergeHiddenCarouselIds,
  saveAccountHiddenCarouselAvatarIds,
} from './hiddenCarouselAvatarSync.js';
import {
  readHiddenCarouselAvatarIds,
  writeHiddenCarouselAvatarIds,
} from './avatarCarouselMembership.js';

function memoryStorage() {
  const store = {};
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key, value) {
      store[key] = String(value);
    },
  };
}

function fakeAccount(initialHiddenIds) {
  const account = { hiddenIds: [...initialHiddenIds], requests: [] };
  account.requestJson = async (path, options = {}) => {
    account.requests.push({ path, method: options.method ?? 'GET', body: options.body });
    if (options.method === 'PUT') {
      account.hiddenIds = [...options.body.assistant_ids];
    }
    return { assistant_ids: [...account.hiddenIds] };
  };
  return account;
}

test('the account list and browser-only hides merge without duplicates', () => {
  assert.deepEqual(mergeHiddenCarouselIds(['a', 'b'], ['b', 'c']), ['a', 'b', 'c']);
});

test('a new browser takes the hidden avatars from the account', async () => {
  const storage = memoryStorage();
  const account = fakeAccount(['ava-1', 'ava-2']);
  const hiddenIds = await loadAccountHiddenCarouselAvatarIds('user-1', {
    requestJson: account.requestJson,
    storage,
  });
  assert.deepEqual(hiddenIds, ['ava-1', 'ava-2']);
  assert.deepEqual(readHiddenCarouselAvatarIds('user-1', storage), ['ava-1', 'ava-2']);
  assert.deepEqual(
    account.requests.map((request) => request.method),
    ['GET']
  );
});

test('the first sync folds this browser\'s earlier hides into the account once', async () => {
  const storage = memoryStorage();
  writeHiddenCarouselAvatarIds('user-1', ['ava-3'], storage);
  const account = fakeAccount(['ava-1']);
  const hiddenIds = await loadAccountHiddenCarouselAvatarIds('user-1', {
    requestJson: account.requestJson,
    storage,
  });
  assert.deepEqual(hiddenIds, ['ava-1', 'ava-3']);
  assert.deepEqual(account.hiddenIds, ['ava-1', 'ava-3']);

  // Restored on another browser: a later sign-in here follows the account
  // instead of bringing the stale browser hide back.
  account.hiddenIds = ['ava-1'];
  const laterHiddenIds = await loadAccountHiddenCarouselAvatarIds('user-1', {
    requestJson: account.requestJson,
    storage,
  });
  assert.deepEqual(laterHiddenIds, ['ava-1']);
  assert.deepEqual(account.hiddenIds, ['ava-1']);
});

test('an unreachable account keeps the browser list', async () => {
  const storage = memoryStorage();
  writeHiddenCarouselAvatarIds('user-1', ['ava-3'], storage);
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    const hiddenIds = await loadAccountHiddenCarouselAvatarIds('user-1', {
      requestJson: async () => {
        throw new Error('offline');
      },
      storage,
    });
    assert.deepEqual(hiddenIds, ['ava-3']);
  } finally {
    console.error = originalConsoleError;
  }
});

test('saving sends the whole hidden list to the account', async () => {
  const account = fakeAccount([]);
  await saveAccountHiddenCarouselAvatarIds('user-1', ['ava-2'], {
    requestJson: account.requestJson,
  });
  assert.deepEqual(account.hiddenIds, ['ava-2']);
  await saveAccountHiddenCarouselAvatarIds('', ['ava-9'], {
    requestJson: account.requestJson,
  });
  assert.equal(account.requests.length, 1);
});
