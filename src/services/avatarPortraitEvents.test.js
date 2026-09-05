import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  notifyAvatarPortraitChanged,
  resetAvatarPortraitListenersForTests,
  subscribeAvatarPortraitChanged,
} from './avatarPortraitEvents.js';

test('listeners hear which avatar changed and can unsubscribe', () => {
  resetAvatarPortraitListenersForTests();
  const heard = [];
  const unsubscribe = subscribeAvatarPortraitChanged((assistantId) =>
    heard.push(assistantId)
  );
  notifyAvatarPortraitChanged('avatar-1');
  notifyAvatarPortraitChanged(null);
  assert.deepEqual(heard, ['avatar-1']);
  unsubscribe();
  notifyAvatarPortraitChanged('avatar-2');
  assert.deepEqual(heard, ['avatar-1']);
});

test('one failing listener does not silence the others', () => {
  resetAvatarPortraitListenersForTests();
  const heard = [];
  const originalError = console.error;
  console.error = () => {};
  try {
    subscribeAvatarPortraitChanged(() => {
      throw new Error('boom');
    });
    subscribeAvatarPortraitChanged((assistantId) => heard.push(assistantId));
    notifyAvatarPortraitChanged('avatar-3');
  } finally {
    console.error = originalError;
  }
  assert.deepEqual(heard, ['avatar-3']);
});
