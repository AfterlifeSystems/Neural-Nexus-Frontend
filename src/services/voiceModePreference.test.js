import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  readVoiceModePreference,
  voiceModeIsOpen,
  writeVoiceModePreference,
} from './voiceModePreference.js';

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

test('an unset or unreadable store is typed chat, not voice', () => {
  assert.equal(readVoiceModePreference(memoryStorage()), false);
  assert.equal(readVoiceModePreference(null), false);
  assert.equal(
    readVoiceModePreference({
      getItem() {
        throw new Error('blocked');
      },
    }),
    false
  );
});

test('choosing voice mode is remembered until Close clears it', () => {
  const storage = memoryStorage();
  writeVoiceModePreference(true, storage);
  assert.equal(readVoiceModePreference(storage), true);
  writeVoiceModePreference(false, storage);
  assert.equal(readVoiceModePreference(storage), false);
});

test('settings and inbox hide the stage; Chat restores it', () => {
  assert.equal(voiceModeIsOpen(true, 'chat'), true);
  assert.equal(voiceModeIsOpen(true, 'avatar-settings'), false);
  assert.equal(voiceModeIsOpen(true, 'inbox'), false);
  assert.equal(voiceModeIsOpen(false, 'chat'), false);
});
