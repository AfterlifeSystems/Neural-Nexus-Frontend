import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assignCreatedAvatarStandardVoice,
  effectiveCreateAvatarGender,
  standardVoiceIdToAssign,
} from './createAvatarVoice.js';

const femaleVoices = [
  { voice_id: 'rachel', name: 'Rachel' },
  { voice_id: 'domi', name: 'Domi' },
];

test('an explicit gender wins over the name', () => {
  assert.equal(
    effectiveCreateAvatarGender({
      selectedGender: 'male',
      avatarName: 'Shivon Zilis',
    }),
    'male'
  );
});

test('an unspecified gender uses the name, then female', () => {
  assert.equal(
    effectiveCreateAvatarGender({
      selectedGender: '',
      avatarName: 'Evan Woods',
    }),
    'male'
  );
  assert.equal(
    effectiveCreateAvatarGender({
      selectedGender: '',
      avatarName: 'Xzzyq',
    }),
    'female'
  );
});

test('a picked voice is stored; otherwise the first catalogue voice', () => {
  assert.equal(
    standardVoiceIdToAssign({
      selectedVoiceId: 'domi',
      voices: femaleVoices,
    }),
    'domi'
  );
  assert.equal(
    standardVoiceIdToAssign({
      selectedVoiceId: '',
      voices: femaleVoices,
    }),
    'rachel'
  );
  assert.equal(
    standardVoiceIdToAssign({
      selectedVoiceId: 'missing',
      voices: femaleVoices,
    }),
    'rachel'
  );
  assert.equal(standardVoiceIdToAssign({ selectedVoiceId: '', voices: [] }), '');
});

test('assigning after create no-ops without an id and otherwise posts the voice', async () => {
  const calls = [];
  assert.equal(
    await assignCreatedAvatarStandardVoice({
      assistantId: 'ava-1',
      voiceId: '',
      setStandardVoice: async (...args) => {
        calls.push(args);
      },
    }),
    null
  );
  await assignCreatedAvatarStandardVoice({
    assistantId: 'ava-1',
    voiceId: 'rachel',
    setStandardVoice: async (...args) => {
      calls.push(args);
      return { standard_voice: { voice_id: 'rachel' } };
    },
  });
  assert.deepEqual(calls, [['ava-1', 'rachel']]);
});
