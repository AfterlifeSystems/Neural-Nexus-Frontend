import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isAdultOnlyAvatar,
  mayKeepAdultOnlyAvatarOnGallery,
  maySeeAdultOnlyAvatarInSearch,
} from './adultOnlyAvatar.js';

const adult = {
  assistant_id: 'adult-1',
  adult_only: true,
  metadata: { user_id: 'owner-1', adult_only: true },
};
const ordinary = { assistant_id: 'guide-1', name: 'Guide' };

test('isAdultOnlyAvatar reads the lifted flag and the metadata flag', () => {
  assert.equal(isAdultOnlyAvatar(adult), true);
  assert.equal(isAdultOnlyAvatar({ metadata: { adult_only: 'true' } }), true);
  assert.equal(isAdultOnlyAvatar(ordinary), false);
  assert.equal(isAdultOnlyAvatar(null), false);
});

test('search hides an adult-only avatar until the viewer verifies age', () => {
  assert.equal(
    maySeeAdultOnlyAvatarInSearch(adult, { viewerUserId: 'visitor-1' }),
    false
  );
  assert.equal(
    maySeeAdultOnlyAvatarInSearch(adult, {
      viewerUserId: 'visitor-1',
      ageVerified: true,
    }),
    true
  );
  assert.equal(
    maySeeAdultOnlyAvatarInSearch(ordinary, { viewerUserId: 'visitor-1' }),
    true
  );
});

test('the administrator sees adult-only avatars in search without verifying age', () => {
  assert.equal(
    maySeeAdultOnlyAvatarInSearch(adult, { viewerUserId: 'owner-1' }),
    false
  );
  assert.equal(
    maySeeAdultOnlyAvatarInSearch(adult, {
      isAdmin: true,
      viewerUserId: 'admin-1',
    }),
    true
  );
});

test('the owner and the administrator still keep an adult-only avatar on the gallery carousel', () => {
  assert.equal(
    mayKeepAdultOnlyAvatarOnGallery(adult, { viewerUserId: 'owner-1' }),
    true
  );
  assert.equal(
    mayKeepAdultOnlyAvatarOnGallery(adult, {
      isAdmin: true,
      viewerUserId: 'admin-1',
    }),
    true
  );
  assert.equal(
    mayKeepAdultOnlyAvatarOnGallery(adult, { viewerUserId: 'visitor-1' }),
    false
  );
  assert.equal(
    mayKeepAdultOnlyAvatarOnGallery(adult, {
      viewerUserId: 'visitor-1',
      ageVerified: true,
    }),
    true
  );
});
