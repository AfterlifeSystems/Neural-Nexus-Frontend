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
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'guide');
  assert.equal(rows[0].canAddToCarousel, true);
  assert.equal(rows[0].onCarousel, false);
  assert.equal(rows[0].originalIndex, -1);
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
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'me');
  assert.equal(rows[0].onCarousel, true);
  assert.equal(rows[0].canAddToCarousel, false);
});

test('Create Avatar is omitted when the query matches only avatars', () => {
  const rows = buildAvatarSearchSuggestions({
    avatars: [personal, guide],
    query: 'evan',
  });
  assert.deepEqual(
    rows.map((row) => row.id),
    ['me']
  );
});
