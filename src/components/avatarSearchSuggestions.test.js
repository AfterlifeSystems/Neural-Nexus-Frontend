import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildAvatarSearchSuggestions } from './avatarSearchSuggestions.js';

const personal = {
  assistant_id: 'me',
  name: 'Evan',
  metadata: { is_personal_avatar_of_creator: true },
};
const guide = { assistant_id: 'guide', name: 'Guide' };
const zebra = { assistant_id: 'z', name: 'Zebra' };

test('an empty query lists every avatar and Create Avatar', () => {
  const rows = buildAvatarSearchSuggestions({
    avatars: [zebra, personal, guide],
    query: '',
    iconsById: { me: 'evan.png' },
  });
  assert.deepEqual(
    rows.map((row) => [row.id, row.canAddToCarousel, row.originalIndex, row.image]),
    [
      ['me', false, 0, 'evan.png'],
      ['guide', false, 1, null],
      ['z', false, 2, null],
      ['create-avatar', false, 3, null],
    ]
  );
});

test('a hidden avatar is offered with a plus, not a carousel seat', () => {
  const rows = buildAvatarSearchSuggestions({
    avatars: [personal, guide],
    query: 'gui',
    hiddenIds: ['guide'],
  });
  assert.equal(rows[0].id, 'guide');
  assert.equal(rows[0].canAddToCarousel, true);
  assert.equal(rows[0].onCarousel, false);
  assert.equal(rows[0].originalIndex, -1);
  assert.equal(rows.at(-1).id, 'create-avatar');
});

test('no name match still offers Create Avatar', () => {
  const rows = buildAvatarSearchSuggestions({
    avatars: [personal],
    query: 'zzzz',
  });
  assert.deepEqual(
    rows.map((row) => row.id),
    ['create-avatar']
  );
});

test('a hidden personal avatar is still on the carousel, not offered as add', () => {
  const rows = buildAvatarSearchSuggestions({
    avatars: [personal, guide],
    query: 'evan',
    hiddenIds: ['me'],
  });
  assert.equal(rows[0].id, 'me');
  assert.equal(rows[0].onCarousel, true);
  assert.equal(rows[0].canAddToCarousel, false);
  assert.equal(rows.at(-1).id, 'create-avatar');
});

test('an adult-only avatar stays out of search until the viewer verifies age', () => {
  const adult = {
    assistant_id: 'adult-1',
    name: 'Adult Avatar',
    adult_only: true,
    metadata: { user_id: 'owner-1', adult_only: true },
  };
  const hidden = buildAvatarSearchSuggestions({
    avatars: [personal, adult],
    query: '',
  });
  assert.deepEqual(
    hidden.map((row) => row.id),
    ['me', 'create-avatar']
  );
  const typedName = buildAvatarSearchSuggestions({
    avatars: [personal, adult],
    query: 'Adult Avatar',
    viewerUserId: 'owner-1',
  });
  assert.deepEqual(
    typedName.map((row) => row.id),
    ['create-avatar']
  );
  // Inert for demos (ADULT_ONLY_FEATURES_ENABLED=false): administrator and
  // age-verified viewers still do not see adult-only avatars in search.
  const adminSearch = buildAvatarSearchSuggestions({
    avatars: [personal, adult],
    query: 'Adult Avatar',
    isAdmin: true,
  });
  assert.deepEqual(
    adminSearch.map((row) => row.id),
    ['create-avatar']
  );
  const shown = buildAvatarSearchSuggestions({
    avatars: [personal, adult],
    query: '',
    ageVerified: true,
  });
  assert.deepEqual(
    shown.map((row) => row.id),
    ['me', 'create-avatar']
  );
});

test('Create Avatar stays last when the query matches avatars', () => {
  const rows = buildAvatarSearchSuggestions({
    avatars: [personal, guide],
    query: 'evan',
  });
  assert.deepEqual(
    rows.map((row) => row.id),
    ['me', 'create-avatar']
  );
});
