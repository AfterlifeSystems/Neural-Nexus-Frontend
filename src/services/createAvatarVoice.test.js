import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assignCreatedAvatarStandardVoice,
  assignStandardVoiceAfterCreate,
  createAvatarGenderChoice,
  effectiveCreateAvatarGender,
  standardVoiceIdToAssign,
  standardVoiceWasChosen,
} from './createAvatarVoice.js';

const femaleVoices = [
  { voice_id: 'rachel', name: 'Rachel' },
  { voice_id: 'domi', name: 'Domi' },
];

const maleVoices = [{ voice_id: 'adam', name: 'Adam' }];

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

test('gender choice records whether the name inferred it', () => {
  assert.deepEqual(
    createAvatarGenderChoice({
      selectedGender: 'female',
      avatarName: 'Evan Woods',
    }),
    { gender: 'female', source: 'selected', givenName: '' }
  );
  assert.deepEqual(
    createAvatarGenderChoice({
      selectedGender: '',
      avatarName: 'Evan Woods',
    }),
    { gender: 'male', source: 'inferred', givenName: 'Evan' }
  );
  assert.deepEqual(
    createAvatarGenderChoice({
      selectedGender: '',
      avatarName: 'Xzzyq',
    }),
    { gender: 'female', source: 'fallback', givenName: '' }
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

test('a voice counts as chosen only when it is in the loaded catalogue', () => {
  assert.equal(
    standardVoiceWasChosen({
      selectedVoiceId: 'domi',
      voices: femaleVoices,
    }),
    true
  );
  assert.equal(
    standardVoiceWasChosen({
      selectedVoiceId: '',
      voices: femaleVoices,
    }),
    false
  );
  assert.equal(
    standardVoiceWasChosen({
      selectedVoiceId: 'missing',
      voices: femaleVoices,
    }),
    false
  );
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

test('after create, an unchosen voice is inferred from the name and stored', async () => {
  const stored = [];
  const listedGenders = [];
  const result = await assignStandardVoiceAfterCreate({
    assistantId: 'ava-1',
    avatarName: 'Evan Woods',
    selectedGender: '',
    selectedVoiceId: '',
    voices: [],
    listVoices: async (gender) => {
      listedGenders.push(gender);
      return maleVoices;
    },
    setStandardVoice: async (assistantId, voiceId) => {
      stored.push([assistantId, voiceId]);
      return { standard_voice: { voice_id: voiceId } };
    },
  });
  assert.deepEqual(listedGenders, ['male']);
  assert.deepEqual(stored, [['ava-1', 'adam']]);
  assert.equal(result.assigned, true);
  assert.equal(result.voiceWasChosen, false);
  assert.equal(result.shouldShowGenderToast, true);
  assert.deepEqual(result.genderChoice, {
    gender: 'male',
    source: 'inferred',
    givenName: 'Evan',
  });
  assert.deepEqual(result.assignedVoice, { voice_id: 'adam', name: 'Adam' });
});

test('after create, a picked voice is stored without a gender toast', async () => {
  const listedGenders = [];
  const result = await assignStandardVoiceAfterCreate({
    assistantId: 'ava-1',
    avatarName: 'Evan Woods',
    selectedGender: 'female',
    selectedVoiceId: 'domi',
    voices: femaleVoices,
    listVoices: async (gender) => {
      listedGenders.push(gender);
      return femaleVoices;
    },
    setStandardVoice: async () => ({ standard_voice: { voice_id: 'domi' } }),
  });
  assert.deepEqual(listedGenders, []);
  assert.equal(result.assigned, true);
  assert.equal(result.voiceWasChosen, true);
  assert.equal(result.shouldShowGenderToast, false);
  assert.equal(result.voiceId, 'domi');
});

test('a failed store still names the inferred gender on the toast', async () => {
  const result = await assignStandardVoiceAfterCreate({
    assistantId: 'ava-1',
    avatarName: 'Shivon Zilis',
    selectedGender: '',
    selectedVoiceId: '',
    voices: femaleVoices,
    setStandardVoice: async () => {
      throw new Error('network');
    },
  });
  assert.equal(result.assigned, false);
  assert.equal(result.shouldShowGenderToast, true);
  assert.equal(result.genderChoice.gender, 'female');
  assert.equal(result.genderChoice.source, 'inferred');
  assert.equal(result.assignError?.message, 'network');
});
