import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  consumeVoiceModeSearchParams,
  openVoiceChat,
  readVoiceModePreference,
  searchRequestsVoiceMode,
  voiceChatPath,
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

test('voiceChatPath opens that avatar on the Chat tab in voice mode', () => {
  assert.equal(voiceChatPath('abc'), '/chat/abc?voice=1');
  assert.equal(voiceChatPath('a/b'), '/chat/a%2Fb?voice=1');
  assert.equal(voiceChatPath(''), '/avatars');
  assert.equal(voiceChatPath(null), '/avatars');
});

test('searchRequestsVoiceMode reads the voice query', () => {
  assert.equal(searchRequestsVoiceMode('?voice=1'), true);
  assert.equal(searchRequestsVoiceMode(new URLSearchParams('voice=1')), true);
  assert.equal(searchRequestsVoiceMode('?tab=settings'), false);
  assert.equal(searchRequestsVoiceMode(''), false);
});

test('consumeVoiceModeSearchParams drops the voice request and the settings tab', () => {
  const next = consumeVoiceModeSearchParams(
    '?voice=1&tab=settings&section=voice&thread=t1'
  );
  assert.equal(next.get('voice'), null);
  assert.equal(next.get('tab'), null);
  assert.equal(next.get('section'), null);
  assert.equal(next.get('thread'), 't1');
});

test('openVoiceChat remembers talking and goes to that avatar', () => {
  const storage = memoryStorage();
  const assigned = [];
  openVoiceChat('abc', {
    storage,
    assign: (path) => assigned.push(path),
  });
  assert.equal(readVoiceModePreference(storage), true);
  assert.deepEqual(assigned, ['/chat/abc?voice=1']);
});
