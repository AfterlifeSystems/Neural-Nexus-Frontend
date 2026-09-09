import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  avatarVoiceSettingsPath,
  rememberVoiceNotReadyShown,
  resetVoiceNotReadyToastForTests,
  sameConversationAsVoiceNotReadyShown,
  voiceNotReadyAlreadyShown,
  voiceNotReadyToastTitle,
} from './voiceNotReadyToast.js';

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
  };
}

test('the notice names a missing voice model', () => {
  assert.equal(
    voiceNotReadyToastTitle('Maya'),
    'Maya does not have a voice model'
  );
  assert.equal(
    voiceNotReadyToastTitle(),
    'This avatar does not have a voice model'
  );
});

test('the notice opens that avatar voice settings', () => {
  assert.equal(
    avatarVoiceSettingsPath('ava/1'),
    '/chat/ava%2F1?tab=settings&section=voice'
  );
  assert.equal(avatarVoiceSettingsPath(), '/avatars');
});

test('the notice is remembered once per conversation', () => {
  resetVoiceNotReadyToastForTests();
  const storage = memoryStorage();
  assert.equal(voiceNotReadyAlreadyShown('ava-1', 'thread-a', storage), false);
  rememberVoiceNotReadyShown('ava-1', 'thread-a', storage);
  assert.equal(voiceNotReadyAlreadyShown('ava-1', 'thread-a', storage), true);
  assert.equal(voiceNotReadyAlreadyShown('ava-1', 'thread-b', storage), false);
  assert.equal(voiceNotReadyAlreadyShown('ava-2', 'thread-a', storage), false);
});

test('an unminted conversation is not remembered across chats', () => {
  resetVoiceNotReadyToastForTests();
  const storage = memoryStorage();
  rememberVoiceNotReadyShown('ava-1', '__new__', storage);
  assert.equal(voiceNotReadyAlreadyShown('ava-1', '__new__', storage), false);
  assert.equal(voiceNotReadyAlreadyShown('ava-1', 'thread-a', storage), false);
});

test('a minted thread is the same conversation the notice was shown for while new', () => {
  assert.equal(
    sameConversationAsVoiceNotReadyShown('__new__', 'thread-a'),
    true
  );
  assert.equal(
    sameConversationAsVoiceNotReadyShown('thread-a', 'thread-a'),
    true
  );
  assert.equal(
    sameConversationAsVoiceNotReadyShown('thread-a', 'thread-b'),
    false
  );
  assert.equal(
    sameConversationAsVoiceNotReadyShown('thread-a', '__new__'),
    false
  );
  assert.equal(sameConversationAsVoiceNotReadyShown(null, 'thread-a'), false);
});
