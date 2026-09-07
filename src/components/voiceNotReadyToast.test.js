import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  avatarVoiceSettingsPath,
  rememberVoiceNotReadyShown,
  resetVoiceNotReadyToastForTests,
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

test('the notice is remembered once per avatar for the tab session', () => {
  resetVoiceNotReadyToastForTests();
  const storage = memoryStorage();
  assert.equal(voiceNotReadyAlreadyShown('ava-1', storage), false);
  rememberVoiceNotReadyShown('ava-1', storage);
  assert.equal(voiceNotReadyAlreadyShown('ava-1', storage), true);
  assert.equal(voiceNotReadyAlreadyShown('ava-2', storage), false);
});
