import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  mediaIntrinsicSize,
  objectContainBox,
  paintedMediaIn,
  portraitWellSizeForConstraint,
} from './voicePortraitBox.js';

test('object-contain letterboxes a tall portrait in a square well', () => {
  assert.deepEqual(objectContainBox(400, 400, 9, 16), {
    x: (400 - 400 * (9 / 16)) / 2,
    y: 0,
    width: 400 * (9 / 16),
    height: 400,
  });
});

test('object-contain letterboxes a wide frame in a square well', () => {
  assert.deepEqual(objectContainBox(400, 400, 16, 9), {
    x: 0,
    y: (400 - 400 * (9 / 16)) / 2,
    width: 400,
    height: 400 * (9 / 16),
  });
});

test('a missing media size fills the well so the glow still has a home', () => {
  assert.deepEqual(objectContainBox(400, 400), {
    x: 0,
    y: 0,
    width: 400,
    height: 400,
  });
});

test('a video reports its decoded size', () => {
  assert.deepEqual(
    mediaIntrinsicSize({
      tagName: 'VIDEO',
      videoWidth: 720,
      videoHeight: 1280,
    }),
    { width: 720, height: 1280 }
  );
  assert.equal(
    mediaIntrinsicSize({ tagName: 'VIDEO', videoWidth: 0, videoHeight: 0 }),
    null
  );
});

test('the portrait well matches a tall clip instead of staying square', () => {
  const size = portraitWellSizeForConstraint(
    { clientWidth: 800, clientHeight: 400 },
    { tagName: 'VIDEO', videoWidth: 9, videoHeight: 16 }
  );
  assert.deepEqual(size, {
    width: 400 * (9 / 16),
    height: 400,
  });
});

test('the portrait well matches a wide clip in a tall stage', () => {
  const size = portraitWellSizeForConstraint(
    { clientWidth: 400, clientHeight: 800 },
    { tagName: 'CANVAS', width: 16, height: 9 }
  );
  assert.deepEqual(size, {
    width: 400,
    height: 400 * (9 / 16),
  });
});

test('an unread clip still gets a square portrait so the stage is not empty', () => {
  assert.deepEqual(
    portraitWellSizeForConstraint({ clientWidth: 800, clientHeight: 400 }, null),
    { width: 400, height: 400 }
  );
});

test('the visible face is the one that is not fading out', () => {
  const outgoing = { classList: { contains: (name) => name === 'opacity-0' } };
  const incoming = { classList: { contains: () => false } };
  assert.equal(
    paintedMediaIn({
      querySelectorAll: () => [outgoing, incoming],
    }),
    incoming
  );
});
