import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createdAvatarStandardVoiceToastCopy,
  createdAvatarStandardVoiceToastId,
} from './createdAvatarStandardVoiceToast.js';

test('the notice names the inferred gender and points at Avatar Settings', () => {
  assert.deepEqual(
    createdAvatarStandardVoiceToastCopy({
      avatarName: 'Evan Woods',
      gender: 'male',
      source: 'inferred',
      givenName: 'Evan',
      voiceName: 'Adam',
      assigned: true,
    }),
    {
      title: 'The avatar was created',
      body: '“Evan” reads as male, so a male stock voice (Adam) was assigned.',
      action: 'Select a different voice in Avatar Settings.',
    }
  );
});

test('an explicit gender does not claim the name decided it', () => {
  assert.deepEqual(
    createdAvatarStandardVoiceToastCopy({
      gender: 'female',
      source: 'selected',
      assigned: true,
    }),
    {
      title: 'The avatar was created',
      body: 'A female stock voice was assigned.',
      action: 'Select a different voice in Avatar Settings.',
    }
  );
});

test('an unknown name says the gender was not specified', () => {
  assert.deepEqual(
    createdAvatarStandardVoiceToastCopy({
      avatarName: 'Xzzyq',
      gender: 'female',
      source: 'fallback',
      assigned: true,
    }),
    {
      title: 'The avatar was created',
      body: 'A female stock voice was assigned. The name did not specify a gender.',
      action: 'Select a different voice in Avatar Settings.',
    }
  );
});

test('a failed save still names the gender and asks for a voice in settings', () => {
  assert.deepEqual(
    createdAvatarStandardVoiceToastCopy({
      gender: 'male',
      source: 'inferred',
      givenName: 'Evan',
      assigned: false,
    }),
    {
      title: 'The avatar was created',
      body: 'A male stock voice could not be saved.',
      action: 'Select a voice in Avatar Settings.',
    }
  );
});

test('the toast id is stable per avatar', () => {
  assert.equal(
    createdAvatarStandardVoiceToastId('ava-1'),
    'created-standard-voice:ava-1'
  );
  assert.equal(
    createdAvatarStandardVoiceToastId(),
    'created-standard-voice:avatar'
  );
});
