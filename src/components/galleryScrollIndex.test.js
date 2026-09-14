import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  GALLERY_AVATAR_BORDER_RADIUS,
  GALLERY_CARD_HEIGHT_FRACTION,
  GALLERY_CARD_MAX_WIDTH_FRACTION,
  GALLERY_CARD_NEIGHBOR_PEEK_PIXELS,
  GALLERY_CREATE_BORDER_RADIUS,
  galleryCardLayout,
  galleryCardWorldLayout,
  galleryFrameHeight,
  galleryBoxIsPainted,
  galleryCoverUv,
  galleryCoverUvRatio,
  galleryIndexFromScroll,
  galleryPortraitUv,
  galleryPortraitUvRect,
  GALLERY_WINDOW_POINTER_IGNORE_SELECTOR,
  isCreateCardAtCenter,
  isPointerOnVisualCard,
  nearestCardOffset,
  nearestGalleryScroll,
  scaleGalleryScroll,
  shouldIgnoreGalleryWindowPointer,
  visualCardIndexAtPointer,
} from './galleryScrollIndex.js';

const componentsDirectory = dirname(fileURLToPath(import.meta.url));

const elementMatching = (selectors) => {
  const element = {
    closest: (selector) => {
      const parts = selector.split(',').map((part) => part.trim());
      return parts.some((part) => selectors.includes(part)) ? element : null;
    },
  };
  return element;
};

test('positive and wrap-left scroll name the same card', () => {
  assert.equal(galleryIndexFromScroll(400, 100, 5), 4);
  assert.equal(galleryIndexFromScroll(-100, 100, 5), 4);
});

test('drag position rounds to the card that is actually centered', () => {
  assert.equal(galleryIndexFromScroll(149, 100, 5), 1);
  assert.equal(galleryIndexFromScroll(151, 100, 5), 2);
  // Math.round(-1.5) is -1 in JS, so -150 belongs to the last card, not the
  // one Math.abs snapping used to pick.
  assert.equal(galleryIndexFromScroll(-150, 100, 5), 4);
});

test('jumping to the last card from 0 takes the short wrap', () => {
  assert.equal(nearestGalleryScroll(0, 4, 100, 5), -100);
});

test('stays on the current wrap instead of jumping to the positive slot', () => {
  assert.equal(nearestGalleryScroll(-100, 3, 100, 5), -200);
});

test('snap after a leftward drag lands on the nearest card', () => {
  assert.equal(nearestGalleryScroll(-150, 4, 100, 5), -100);
});

test('Create is at centre only while its plane covers the midpoint', () => {
  assert.equal(isCreateCardAtCenter(0, 100), true);
  assert.equal(isCreateCardAtCenter(49, 100), true);
  assert.equal(isCreateCardAtCenter(50, 100), false);
  assert.equal(isCreateCardAtCenter(-80, 100), false);
  assert.equal(isCreateCardAtCenter(0, 0), false);
});

test('a layout pass that widens the slots keeps the same card centred', () => {
  assert.equal(scaleGalleryScroll(200, 100, 120), 240);
  assert.equal(galleryIndexFromScroll(240, 120, 5), 2);
});

test('a click in the gap between painted cards is not a hit', () => {
  assert.equal(isPointerOnVisualCard(55, 0, 100), false);
  assert.equal(isPointerOnVisualCard(40, 0, 100), true);
  assert.equal(
    visualCardIndexAtPointer(60, [
      { x: 0, visualWidth: 100, index: 0 },
      { x: 120, visualWidth: 100, index: 1 },
    ]),
    -1
  );
  assert.equal(
    visualCardIndexAtPointer(125, [
      { x: 0, visualWidth: 100, index: 0 },
      { x: 120, visualWidth: 100, index: 1 },
    ]),
    1
  );
});

test('hide/settings follow the nearer card, not the gap', () => {
  assert.equal(nearestCardOffset([-40, 80, 160]), -40);
  assert.equal(nearestCardOffset([]), 0);
});

test('a pointer on the help pill is not a gallery drag', () => {
  const pill = elementMatching(['[data-evan-assist-overlay]']);
  const canvas = { closest: () => null };
  assert.equal(shouldIgnoreGalleryWindowPointer(pill), true);
  assert.equal(shouldIgnoreGalleryWindowPointer({ parentElement: pill }), true);
  assert.equal(shouldIgnoreGalleryWindowPointer(canvas), false);
  assert.equal(shouldIgnoreGalleryWindowPointer(null), false);
});

test('a pointer on User Settings is not a gallery drag', () => {
  const menu = elementMatching(['[data-user-settings-menu]']);
  assert.equal(shouldIgnoreGalleryWindowPointer(menu), true);
  assert.equal(shouldIgnoreGalleryWindowPointer({ parentElement: menu }), true);
  assert.match(
    GALLERY_WINDOW_POINTER_IGNORE_SELECTOR,
    /data-user-settings-menu/
  );
});

test('a square photo fills a square card without letterbox', () => {
  const ratio = galleryCoverUvRatio(1, 1, 512, 512);
  assert.deepEqual(ratio, { x: 1, y: 1 });
  assert.deepEqual(galleryCoverUv(0, 0, ratio), { x: 0, y: 0 });
  assert.deepEqual(galleryCoverUv(1, 1, ratio), { x: 1, y: 1 });
});

test('an unframed portrait disc uses the same cover crop as a message portrait', () => {
  const rect = galleryPortraitUvRect(9, 16);
  const cssTopFromTop = (0 - rect.originY) / rect.sizeY;
  const topOfCard = galleryPortraitUv(0.5, 1, rect);
  assert.ok(Math.abs(topOfCard.y - (1 - cssTopFromTop)) < 1e-9);
  assert.ok(cssTopFromTop > 0);
});

test('a settings pan that shows the head samples the top of the photo', () => {
  const rect = galleryPortraitUvRect(9, 16, {
    scale: 1,
    offsetX: 0,
    offsetY: (16 / 9 - 1) / 2,
    mediaWidth: 9,
    mediaHeight: 16,
  });
  const topOfCard = galleryPortraitUv(0.5, 1, rect);
  assert.ok(Math.abs(topOfCard.y - 1) < 1e-9);
});

test('carousel avatars are circular like the message portraits', () => {
  assert.equal(GALLERY_AVATAR_BORDER_RADIUS, 0.5);
  assert.equal(GALLERY_CREATE_BORDER_RADIUS, 0.05);
  const gallerySource = readFileSync(
    join(componentsDirectory, 'CircularGallery.jsx'),
    'utf8'
  );
  assert.match(gallerySource, /GALLERY_AVATAR_BORDER_RADIUS/);
  assert.match(gallerySource, /galleryCardWorldLayout/);
  assert.match(gallerySource, /uPortraitOrigin/);
  assert.match(gallerySource, /uPortraitSize/);
  assert.match(gallerySource, /1\.0 - vUv\.y/);
  assert.doesNotMatch(
    gallerySource,
    /if \(uv\.x < 0\.0 \|\| uv\.x > 1\.0 \|\| uv\.y < 0\.0 \|\| uv\.y > 1\.0\)/
  );
});

test('a wide gallery keeps discs at 60% of height', () => {
  const layout = galleryCardLayout(1600, 800);
  assert.equal(layout.pixelSize, 800 * GALLERY_CARD_HEIGHT_FRACTION);
  assert.equal(layout.paddingPixels, layout.pixelSize * 0.2);
});

test('a tall phone gallery caps the disc so neighbors peek', () => {
  const layout = galleryCardLayout(358, 650);
  const heightBased = 650 * GALLERY_CARD_HEIGHT_FRACTION;
  assert.ok(layout.pixelSize < heightBased);
  assert.ok(
    layout.pixelSize <= 358 * GALLERY_CARD_MAX_WIDTH_FRACTION + 1e-9
  );
  const leftoverEachSide = (358 - layout.pixelSize) / 2;
  const peek = leftoverEachSide - layout.paddingPixels;
  assert.ok(peek + 1e-9 >= GALLERY_CARD_NEIGHBOR_PEEK_PIXELS);
});

test('a wide gallery box keeps the leftover height', () => {
  assert.equal(galleryFrameHeight(1600, 800), 800);
});

test('an unmeasured width does not shrink the gallery to a sliver', () => {
  assert.equal(galleryFrameHeight(0, 650), 650);
  assert.equal(galleryFrameHeight(1, 650), 650);
});

test('WebGL must not start on a 0×0 first paint', () => {
  assert.equal(galleryBoxIsPainted(0, 0), false);
  assert.equal(galleryBoxIsPainted(800, 0), false);
  assert.equal(galleryBoxIsPainted(0, 400), false);
  assert.equal(galleryBoxIsPainted(1, 1), false);
  assert.equal(galleryBoxIsPainted(800, 400), true);
});

test('a tall phone gallery box shrinks until discs fill 60%', () => {
  const width = 358;
  const available = 650;
  const height = galleryFrameHeight(width, available);
  assert.ok(height < available);
  const layout = galleryCardLayout(width, height);
  assert.equal(
    layout.pixelSize,
    width * GALLERY_CARD_MAX_WIDTH_FRACTION
  );
  assert.ok(
    Math.abs(layout.heightFraction - GALLERY_CARD_HEIGHT_FRACTION) < 1e-9
  );
  const leftoverEachSide = (width - layout.pixelSize) / 2;
  const peek = leftoverEachSide - layout.paddingPixels;
  assert.ok(peek + 1e-9 >= GALLERY_CARD_NEIGHBOR_PEEK_PIXELS);
});

test('world units follow the pixel layout through the camera viewport', () => {
  const world = galleryCardWorldLayout(1600, 800, 33.14, 16.57);
  assert.equal(world.cardWorld, (world.pixelSize / 800) * 16.57);
  assert.equal(world.paddingWorld, (world.paddingPixels / 1600) * 33.14);
});

test('Create overlay and hide controls follow the painted disc size', () => {
  const carouselSource = readFileSync(
    join(componentsDirectory, 'AvatarSelectionComponent.jsx'),
    'utf8'
  );
  assert.match(carouselSource, /relative z-30 flex flex-col items-center/);
  assert.match(carouselSource, /data-carousel-card-actions/);
  assert.match(carouselSource, /cardPixelSize/);
  assert.match(carouselSource, /galleryCardLayout/);
  assert.match(carouselSource, /galleryFrameHeight/);
  assert.match(carouselSource, /galleryColumnRef/);
  assert.match(carouselSource, /galleryRegionRef/);
  assert.match(carouselSource, /galleryStageRef/);
  assert.match(carouselSource, /galleryFrameRef/);
  assert.match(carouselSource, /data-gallery-region/);
  assert.match(carouselSource, /data-gallery-stage/);
  assert.match(carouselSource, /flex-1 flex-col justify-center/);
  assert.match(carouselSource, /data-gallery-frame/);
  assert.match(carouselSource, /relative min-h-0 w-full overflow-hidden/);
  assert.match(carouselSource, /shrink-0 flex-col overflow-hidden rounded-2xl/);
  assert.equal(carouselSource.includes('stage.style.flexGrow'), false);
  assert.match(carouselSource, /width: '36px'/);
  assert.match(carouselSource, /galleryBoxIsPainted/);
  assert.match(carouselSource, /measureUntilPainted/);
  assert.match(carouselSource, /frame.style.flexBasis = nextHeight/);
  const gallerySource = readFileSync(
    join(componentsDirectory, 'CircularGallery.jsx'),
    'utf8'
  );
  assert.match(gallerySource, /galleryBoxIsPainted/);
  assert.match(gallerySource, /startWhenPainted/);
  assert.match(
    gallerySource,
    /className="absolute inset-0 overflow-hidden cursor-grab/
  );
  assert.match(carouselSource, /absolute left-1\/2 z-20 flex items-center/);
  assert.match(
    carouselSource,
    /userSettingsMenuOpen \? 'pointer-events-none' : 'pointer-events-auto'/
  );
});
