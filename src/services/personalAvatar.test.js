import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  personalAssistantIdOf,
  personalAvatarOf,
  transcribeAssistantIdOf,
} from './personalAvatar.js';

const personal = {
  assistant_id: 'me',
  name: 'Evan',
  metadata: { is_personal_avatar_of_creator: true },
};
const character = {
  assistant_id: 'char',
  name: 'Guide',
  metadata: { is_personal_avatar_of_creator: false },
};

test('the personal avatar is the flagged one in the list', () => {
  assert.equal(personalAvatarOf([character, personal]), personal);
  assert.equal(personalAssistantIdOf([character, personal]), 'me');
  assert.equal(personalAvatarOf([character]), null);
  assert.equal(personalAssistantIdOf([]), null);
});

test('speech-to-text of the signed-in person uses the personal avatar', () => {
  assert.equal(
    transcribeAssistantIdOf({
      userAvatars: [character, personal],
      fallbackAssistantId: 'char',
    }),
    'me'
  );
  assert.equal(
    transcribeAssistantIdOf({
      userAvatars: [character],
      fallbackAssistantId: 'char',
    }),
    'char'
  );
  assert.equal(
    transcribeAssistantIdOf({
      userAvatars: [personal],
      fallbackAssistantId: 'char',
      isAnonymous: true,
    }),
    'char'
  );
});
