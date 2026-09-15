import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  GALLERY_CAROUSEL_INTENT_CHAT,
  GALLERY_CAROUSEL_INTENT_NEXT,
  GALLERY_CAROUSEL_INTENT_PREVIOUS,
  GALLERY_CAROUSEL_INTENT_SELECT,
  GALLERY_CAROUSEL_INTENT_SETTINGS,
  galleryCarouselKeyIntent,
} from './galleryCarouselKeyboard.js';

const componentsDirectory = dirname(fileURLToPath(import.meta.url));

const avatarContext = { frontCardType: 'avatar' };

test('left and right still turn the carousel', () => {
  assert.equal(
    galleryCarouselKeyIntent({ key: 'ArrowLeft' }, avatarContext),
    GALLERY_CAROUSEL_INTENT_PREVIOUS
  );
  assert.equal(
    galleryCarouselKeyIntent({ key: 'ArrowRight' }, avatarContext),
    GALLERY_CAROUSEL_INTENT_NEXT
  );
});

test('up opens chat and down opens settings for the front avatar', () => {
  assert.equal(
    galleryCarouselKeyIntent({ key: 'ArrowUp' }, avatarContext),
    GALLERY_CAROUSEL_INTENT_CHAT
  );
  assert.equal(
    galleryCarouselKeyIntent({ key: 'ArrowDown' }, avatarContext),
    GALLERY_CAROUSEL_INTENT_SETTINGS
  );
});

test('enter still selects the front card', () => {
  assert.equal(
    galleryCarouselKeyIntent({ key: 'Enter' }, avatarContext),
    GALLERY_CAROUSEL_INTENT_SELECT
  );
  assert.equal(
    galleryCarouselKeyIntent({ key: 'Enter' }, { frontCardType: 'create' }),
    GALLERY_CAROUSEL_INTENT_SELECT
  );
});

test('up and down do nothing on the Create slot', () => {
  assert.equal(
    galleryCarouselKeyIntent({ key: 'ArrowUp' }, { frontCardType: 'create' }),
    null
  );
  assert.equal(
    galleryCarouselKeyIntent({ key: 'ArrowDown' }, { frontCardType: 'create' }),
    null
  );
});

test('search, the account menu, and Create keep the arrows', () => {
  assert.equal(
    galleryCarouselKeyIntent(
      { key: 'ArrowUp' },
      { ...avatarContext, searchOwnsKeys: true }
    ),
    null
  );
  assert.equal(
    galleryCarouselKeyIntent(
      { key: 'ArrowDown' },
      { ...avatarContext, menuOpen: true }
    ),
    null
  );
  assert.equal(
    galleryCarouselKeyIntent(
      { key: 'ArrowUp' },
      { ...avatarContext, modalOpen: true }
    ),
    null
  );
});

test('modifier chords are left to the browser', () => {
  assert.equal(
    galleryCarouselKeyIntent(
      { key: 'ArrowUp', ctrlKey: true },
      avatarContext
    ),
    null
  );
  assert.equal(
    galleryCarouselKeyIntent(
      { key: 'ArrowDown', metaKey: true },
      avatarContext
    ),
    null
  );
});

test('the gallery wires up to chat and down to settings', () => {
  const carouselSource = readFileSync(
    join(componentsDirectory, 'AvatarSelectionComponent.jsx'),
    'utf8'
  );
  assert.match(carouselSource, /galleryCarouselKeyIntent/);
  assert.match(carouselSource, /GALLERY_CAROUSEL_INTENT_CHAT/);
  assert.match(carouselSource, /GALLERY_CAROUSEL_INTENT_SETTINGS/);
});
