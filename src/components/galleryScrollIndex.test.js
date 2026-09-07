import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  galleryIndexFromScroll,
  isCreateCardAtCenter,
  isPointerOnVisualCard,
  nearestCardOffset,
  nearestGalleryScroll,
  scaleGalleryScroll,
  shouldIgnoreGalleryWindowPointer,
  visualCardIndexAtPointer,
} from './galleryScrollIndex.js';

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
  const pill = {
    closest: (selector) =>
      selector === '[data-evan-assist-overlay]' ? pill : null,
  };
  const canvas = { closest: () => null };
  assert.equal(shouldIgnoreGalleryWindowPointer(pill), true);
  assert.equal(shouldIgnoreGalleryWindowPointer({ parentElement: pill }), true);
  assert.equal(shouldIgnoreGalleryWindowPointer(canvas), false);
  assert.equal(shouldIgnoreGalleryWindowPointer(null), false);
});
