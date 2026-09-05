import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  galleryIndexFromScroll,
  nearestGalleryScroll,
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
