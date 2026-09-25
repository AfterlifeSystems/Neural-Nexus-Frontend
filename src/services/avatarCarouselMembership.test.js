import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  avatarsOnCarousel,
  avatarsVisibleOnGlobe,
  clampCarouselIndex,
  canHideAvatarOnCarousel,
  carouselCompanionAction,
  hideAvatarOnCarousel,
  isAvatarOnCarousel,
  readHiddenCarouselAvatarIds,
  showAvatarOnCarousel,
  subscribeHiddenCarouselAvatarIds,
  writeHiddenCarouselAvatarIds,
} from './avatarCarouselMembership.js';

function memoryStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key)
        ? store[key]
        : null;
    },
    setItem(key, value) {
      store[key] = String(value);
    },
    removeItem(key) {
      delete store[key];
    },
  };
}

const personal = {
  assistant_id: 'me',
  name: 'Evan',
  metadata: { is_personal_avatar_of_creator: true },
};
const guide = { assistant_id: 'guide', name: 'Guide' };
const publicAvatar = { avatar_id: 'pub', name: 'Public' };

test('every listed avatar starts on the carousel', () => {
  assert.equal(isAvatarOnCarousel(personal, []), true);
  assert.equal(isAvatarOnCarousel(publicAvatar, []), true);
  assert.deepEqual(avatarsOnCarousel([personal, guide, publicAvatar], []), [
    personal,
    guide,
    publicAvatar,
  ]);
});

test('hiding takes the card off the ring and showing puts it back', () => {
  const hidden = hideAvatarOnCarousel(guide, []);
  assert.deepEqual(hidden, ['guide']);
  assert.equal(isAvatarOnCarousel(guide, hidden), false);
  assert.deepEqual(avatarsOnCarousel([personal, guide, publicAvatar], hidden), [
    personal,
    publicAvatar,
  ]);
  assert.deepEqual(showAvatarOnCarousel('guide', hidden), []);
});

test('a missing id is never treated as a carousel card', () => {
  assert.equal(isAvatarOnCarousel({ name: 'No Id' }, []), false);
  assert.deepEqual(hideAvatarOnCarousel('', ['guide']), ['guide']);
  assert.deepEqual(showAvatarOnCarousel('  ', ['guide']), ['guide']);
});

test('hidden ids persist per account', () => {
  const storage = memoryStorage();
  writeHiddenCarouselAvatarIds('user-1', ['guide', 'guide', ''], storage);
  assert.deepEqual(readHiddenCarouselAvatarIds('user-1', storage), ['guide']);
  assert.deepEqual(readHiddenCarouselAvatarIds('user-2', storage), []);
  writeHiddenCarouselAvatarIds('user-1', ['pub'], storage);
  assert.deepEqual(readHiddenCarouselAvatarIds('user-1', storage), ['pub']);
});

test('a broken store reads as no hidden cards', () => {
  const storage = memoryStorage({
    neural_nexus_hidden_carousel_avatars: 'not-json',
  });
  assert.deepEqual(readHiddenCarouselAvatarIds('user-1', storage), []);
});

test('hiding the front card keeps the next seat, or the last card', () => {
  assert.equal(clampCarouselIndex(1, 3), 1);
  assert.equal(clampCarouselIndex(2, 2), 1);
  assert.equal(clampCarouselIndex(0, 1), 0);
  assert.equal(clampCarouselIndex(4, 0), 0);
});

test('the personal avatar cannot be taken off the carousel', () => {
  assert.equal(canHideAvatarOnCarousel(personal), false);
  assert.equal(canHideAvatarOnCarousel(guide), true);
  assert.deepEqual(hideAvatarOnCarousel(personal, []), []);
  assert.equal(isAvatarOnCarousel(personal, ['me']), true);
  assert.deepEqual(avatarsOnCarousel([personal, guide], ['me', 'guide']), [
    personal,
  ]);
});

test('the personal avatar opens inbox; other cards hide', () => {
  assert.equal(carouselCompanionAction(personal), 'inbox');
  assert.equal(carouselCompanionAction(guide), 'hide');
  assert.equal(carouselCompanionAction({ name: 'No Id' }), null);
});

test('signed-out visitors still see every public geo pin', () => {
  const pinned = [publicAvatar, guide];
  assert.deepEqual(
    avatarsVisibleOnGlobe(pinned, {
      galleryAvatars: [],
      hiddenCarouselIds: ['pub'],
      hasSignedInAccount: false,
    }),
    pinned
  );
});

test('a signed-in account only keeps carousel pins on the globe', () => {
  const geoOnly = { assistant_id: 'geo-only', name: 'Geo Only' };
  const pinned = [personal, guide, publicAvatar, geoOnly];
  const gallery = [personal, guide, publicAvatar];
  assert.deepEqual(
    avatarsVisibleOnGlobe(pinned, {
      galleryAvatars: gallery,
      hiddenCarouselIds: ['pub'],
      hasSignedInAccount: true,
    }),
    [personal, guide]
  );
});

test('writing hidden ids notifies globe subscribers', () => {
  const storage = memoryStorage();
  const seen = [];
  const unsubscribe = subscribeHiddenCarouselAvatarIds((userId, hiddenIds) => {
    seen.push({ userId, hiddenIds });
  });
  writeHiddenCarouselAvatarIds('user-1', ['pub'], storage);
  unsubscribe();
  writeHiddenCarouselAvatarIds('user-1', ['guide'], storage);
  assert.deepEqual(seen, [{ userId: 'user-1', hiddenIds: ['pub'] }]);
});
