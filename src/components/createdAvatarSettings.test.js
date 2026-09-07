import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  avatarSettingsPath,
  resolveCreatedAvatar,
  unwrapCreatedAvatarRecord,
} from './createdAvatarSettings.js';

const listedMaya = {
  assistant_id: 'maya-1',
  name: 'Maya',
  metadata: { user_id: 'owner-1' },
};
const listedGuide = {
  assistant_id: 'guide-1',
  name: 'Guide',
  metadata: { user_id: 'owner-1' },
};

test('unwraps a bare assistant record or a nested create payload', () => {
  assert.deepEqual(unwrapCreatedAvatarRecord(listedMaya), listedMaya);
  assert.deepEqual(
    unwrapCreatedAvatarRecord({ assistant: { assistant_id: 'nested-1' } }),
    { assistant_id: 'nested-1' }
  );
  assert.deepEqual(unwrapCreatedAvatarRecord('  minted-9  '), {
    assistant_id: 'minted-9',
  });
  assert.equal(unwrapCreatedAvatarRecord(null), null);
  assert.equal(unwrapCreatedAvatarRecord({ message: 'ok' }), null);
});

test('prefers the refreshed list record so ownership metadata is present', () => {
  const created = { assistant_id: 'maya-1', name: 'Maya' };
  assert.deepEqual(
    resolveCreatedAvatar({
      created,
      listedAvatars: [listedGuide, listedMaya],
      previousAvatars: [listedGuide],
    }),
    listedMaya
  );
});

test('falls back to the only avatar that was not on the previous list', () => {
  assert.deepEqual(
    resolveCreatedAvatar({
      created: { message: 'created' },
      listedAvatars: [listedGuide, listedMaya],
      previousAvatars: [listedGuide],
    }),
    listedMaya
  );
});

test('matches the typed name when the create response has no id', () => {
  assert.deepEqual(
    resolveCreatedAvatar({
      created: {},
      listedAvatars: [listedGuide, listedMaya],
      previousAvatars: [listedGuide],
      createdName: 'Maya',
    }),
    listedMaya
  );
});

test('uses the create record when the list refresh is empty', () => {
  const created = { assistant_id: 'new-9', name: 'Nova' };
  assert.deepEqual(
    resolveCreatedAvatar({
      created,
      listedAvatars: [],
      previousAvatars: [listedGuide],
    }),
    created
  );
});

test('settings path is the workspace URL ChatArea already honours', () => {
  assert.equal(
    avatarSettingsPath(listedMaya),
    '/chat/maya-1?tab=settings'
  );
  assert.equal(
    avatarSettingsPath({ avatar_id: 'id/with space' }),
    '/chat/id%2Fwith%20space?tab=settings'
  );
  assert.equal(avatarSettingsPath(null), null);
  assert.equal(avatarSettingsPath({ name: 'No Id' }), null);
});
