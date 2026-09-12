import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ADMIN_ACCOUNT_EMAIL } from '../config/adminAccount.js';
import { shouldPromptForMissingClonedVoice } from './missingClonedVoicePrompt.js';

const administrator = { id: 'admin-1', email: ADMIN_ACCOUNT_EMAIL };
const otherUser = { id: 'user-2', email: 'someone@example.com' };

const adminCharacter = {
  metadata: { user_id: 'admin-1', is_personal_avatar_of_creator: false },
};
const adminPersonal = {
  metadata: { user_id: 'admin-1', is_personal_avatar_of_creator: true },
};
const userCharacter = {
  metadata: { user_id: 'user-2', is_personal_avatar_of_creator: false },
};
const userPersonal = {
  metadata: { user_id: 'user-2', is_personal_avatar_of_creator: true },
};

test('the administrator is not asked to clone a character they created', () => {
  assert.equal(
    shouldPromptForMissingClonedVoice({
      avatar: adminCharacter,
      user: administrator,
    }),
    false
  );
});

test("the administrator is still asked to clone their personal avatar", () => {
  assert.equal(
    shouldPromptForMissingClonedVoice({
      avatar: adminPersonal,
      user: administrator,
    }),
    true
  );
});

test('another account is still asked to clone an avatar they created', () => {
  assert.equal(
    shouldPromptForMissingClonedVoice({
      avatar: userCharacter,
      user: otherUser,
    }),
    true
  );
  assert.equal(
    shouldPromptForMissingClonedVoice({
      avatar: userPersonal,
      user: otherUser,
    }),
    true
  );
});

test('the administrator is asked to clone an avatar somebody else created', () => {
  assert.equal(
    shouldPromptForMissingClonedVoice({
      avatar: userCharacter,
      user: administrator,
    }),
    true
  );
});

test('a missing avatar or user still allows the notice', () => {
  assert.equal(shouldPromptForMissingClonedVoice({}), true);
  assert.equal(
    shouldPromptForMissingClonedVoice({ avatar: adminCharacter, user: null }),
    true
  );
});
