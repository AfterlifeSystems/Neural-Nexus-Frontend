import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  avatarsWithPersonalFirst,
  isPersonalCreatorAvatar,
  startingCarouselIndex,
} from './avatarListOrder.js';

const personal = {
  assistant_id: 'me',
  name: 'Evan',
  metadata: { is_personal_avatar_of_creator: true },
};
const other = { assistant_id: 'char', name: 'Guide' };
const publicListing = {
  assistant_id: 'pub',
  name: 'Public',
  metadata: { is_personal_avatar_of_creator: false },
};

test('the personal avatar is recognised only by the boolean flag', () => {
  assert.equal(isPersonalCreatorAvatar(personal), true);
  assert.equal(isPersonalCreatorAvatar(other), false);
  assert.equal(isPersonalCreatorAvatar(publicListing), false);
  assert.equal(
    isPersonalCreatorAvatar({
      metadata: { is_personal_avatar_of_creator: 'true' },
    }),
    false
  );
});

test('the personal avatar is first and the rest are alphabetical', () => {
  const zebra = { assistant_id: 'z', name: 'Zebra' };
  const apple = { assistant_id: 'a', name: 'apple' };
  assert.deepEqual(
    avatarsWithPersonalFirst([zebra, publicListing, personal, apple, other]),
    [personal, apple, other, publicListing, zebra]
  );
});

test('without a personal avatar the whole list is alphabetical', () => {
  const zebra = { assistant_id: 'z', name: 'Zebra' };
  assert.deepEqual(avatarsWithPersonalFirst([zebra, other, publicListing]), [
    other,
    publicListing,
    zebra,
  ]);
  assert.deepEqual(avatarsWithPersonalFirst(null), []);
  assert.deepEqual(avatarsWithPersonalFirst(undefined), []);
});

test('the carousel opens on the personal avatar, not a later card', () => {
  assert.equal(startingCarouselIndex([personal, other, publicListing]), 0);
  assert.equal(startingCarouselIndex([other, personal]), 1);
  assert.equal(startingCarouselIndex([other, publicListing]), 0);
  assert.equal(startingCarouselIndex([]), 0);
});
