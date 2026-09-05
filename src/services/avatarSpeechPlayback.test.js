import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canUseAvatarSpeechInput,
  canUseAvatarSpeechPlayback,
} from './avatarSpeechPlayback.js';

const ADMIN_EMAIL = 'e.woods.business@icloud.com';
const adminUser = { id: 'admin-1', email: ADMIN_EMAIL };
const regularUser = { id: 'user-1', email: 'person@example.com' };
const otherUser = { id: 'user-2', email: 'other@example.com' };

const personalOwned = {
  assistant_id: 'a1',
  metadata: {
    user_id: 'user-1',
    is_personal_avatar_of_creator: true,
    is_public: false,
  },
};

const characterOwned = {
  assistant_id: 'a2',
  metadata: {
    user_id: 'user-1',
    is_personal_avatar_of_creator: false,
    is_public: false,
  },
};

const adminCharacter = {
  assistant_id: 'a3',
  metadata: {
    user_id: 'admin-1',
    is_personal_avatar_of_creator: false,
    is_public: false,
  },
};

const adminCharacterPublic = {
  assistant_id: 'a3-public',
  metadata: {
    user_id: 'admin-1',
    is_personal_avatar_of_creator: false,
    is_public: true,
  },
};

const publicListing = {
  assistant_id: 'a4',
  // Public listings strip metadata entirely.
};

test('refuses without an avatar', () => {
  assert.equal(canUseAvatarSpeechInput(null, regularUser), false);
  assert.equal(canUseAvatarSpeechPlayback(null, regularUser), false);
});

test('signed-in reader may dictate on a personal avatar', () => {
  assert.equal(canUseAvatarSpeechInput(personalOwned, regularUser), true);
});

test('signed-in personal avatar may speak', () => {
  assert.equal(canUseAvatarSpeechPlayback(personalOwned, regularUser), true);
});

test('signed-in non-personal avatar may dictate but not play cloned audio', () => {
  assert.equal(canUseAvatarSpeechInput(characterOwned, regularUser), true);
  assert.equal(canUseAvatarSpeechPlayback(characterOwned, regularUser), false);
});

test('signed-in user may dictate on an admin character inside /chat', () => {
  assert.equal(canUseAvatarSpeechInput(adminCharacterPublic, otherUser), true);
  assert.equal(canUseAvatarSpeechPlayback(adminCharacterPublic, otherUser), false);
});

test('string "false" personal flag does not unlock speech', () => {
  const spoofed = {
    ...characterOwned,
    metadata: {
      ...characterOwned.metadata,
      is_personal_avatar_of_creator: 'false',
    },
  };
  assert.equal(canUseAvatarSpeechPlayback(spoofed, regularUser), false);
});

test('unsigned reader may not dictate or play audio on a private personal avatar', () => {
  assert.equal(canUseAvatarSpeechInput(personalOwned, null), false);
  assert.equal(canUseAvatarSpeechPlayback(personalOwned, null), false);
});

test('administrator-created avatar may speak for that account', () => {
  assert.equal(canUseAvatarSpeechPlayback(adminCharacter, adminUser), true);
});

test('other accounts cannot speak an admin character inside /chat', () => {
  assert.equal(canUseAvatarSpeechPlayback(adminCharacterPublic, otherUser), false);
  assert.equal(canUseAvatarSpeechPlayback(publicListing, otherUser), false);
});

test('signed-in reader may dictate a public listing inside /chat without hearing it', () => {
  assert.equal(canUseAvatarSpeechInput(publicListing, otherUser), true);
  assert.equal(canUseAvatarSpeechPlayback(publicListing, otherUser), false);
});

test('shared character link with metadata allows dictation but not playback', () => {
  assert.equal(
    canUseAvatarSpeechInput(adminCharacterPublic, otherUser, {
      pathname: `/share/${adminCharacterPublic.assistant_id}`,
    }),
    true
  );
  assert.equal(
    canUseAvatarSpeechPlayback(adminCharacterPublic, otherUser, {
      pathname: `/share/${adminCharacterPublic.assistant_id}`,
    }),
    false
  );
});

test('shared avatar chat path allows dictation and playback without a session', () => {
  assert.equal(
    canUseAvatarSpeechInput(publicListing, null, {
      pathname: '/share/a4',
    }),
    true
  );
  assert.equal(
    canUseAvatarSpeechPlayback(publicListing, null, {
      pathname: '/share/a4',
    }),
    true
  );
});

test('shared link with metadata still requires a personal avatar', () => {
  assert.equal(
    canUseAvatarSpeechPlayback(adminCharacterPublic, otherUser, {
      pathname: `/share/${adminCharacterPublic.assistant_id}`,
    }),
    false
  );
  assert.equal(
    canUseAvatarSpeechPlayback(
      {
        ...personalOwned,
        metadata: { ...personalOwned.metadata, is_public: true },
      },
      null,
      { pathname: '/share/a1' }
    ),
    true
  );
});

test("owner's public personal avatar still allows speech", () => {
  const sharedPersonal = {
    ...personalOwned,
    metadata: { ...personalOwned.metadata, is_public: true },
  };
  assert.equal(canUseAvatarSpeechPlayback(sharedPersonal, regularUser), true);
});
