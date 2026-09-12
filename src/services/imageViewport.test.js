import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  IMAGE_VIEWPORT_MAX_SCALE,
  IMAGE_VIEWPORT_MIN_SCALE,
  IMAGE_VIEWPORT_RESET,
  clampImageViewport,
  clampImageViewportScale,
  imageViewportCssTransform,
  imageViewportIsZoomed,
  imageViewportCanPan,
  imageViewportCoverSize,
  imageViewportPanLimit,
  imageViewportPointerDistance,
  imageViewportScaleAfterPinch,
  imageViewportScaleAfterStep,
  imageViewportScaleAfterWheel,
  panImageViewport,
  parseStoredImageViewport,
  readImageViewport,
  writeImageViewport,
  zoomImageViewport,
} from './imageViewport.js';

test('scale stays between one and eight', () => {
  assert.equal(clampImageViewportScale(0.2), IMAGE_VIEWPORT_MIN_SCALE);
  assert.equal(clampImageViewportScale(IMAGE_VIEWPORT_MAX_SCALE + 3), 8);
  assert.equal(clampImageViewportScale('nope'), IMAGE_VIEWPORT_MIN_SCALE);
});

test('at scale one the picture cannot slide', () => {
  assert.deepEqual(imageViewportPanLimit(1, { width: 400, height: 200 }), {
    maxX: 0,
    maxY: 0,
  });
  assert.deepEqual(
    clampImageViewport({ scale: 1, offsetX: 80, offsetY: -40 }, {
      width: 400,
      height: 200,
    }),
    IMAGE_VIEWPORT_RESET
  );
});

test('cover size is empty until the picture’s own size is known', () => {
  assert.deepEqual(
    imageViewportCoverSize({ width: 128, height: 128 }, null),
    { width: 0, height: 0 }
  );
});

test('a tall cover picture can slide at scale one', () => {
  const frame = {
    width: 128,
    height: 128,
    fit: 'cover',
    mediaWidth: 128,
    mediaHeight: 256,
  };
  assert.deepEqual(imageViewportCoverSize(frame, frame), {
    width: 128,
    height: 256,
  });
  assert.deepEqual(imageViewportPanLimit(1, frame), {
    maxX: 0,
    maxY: 64,
  });
  assert.equal(imageViewportCanPan({ scale: 1 }, frame), true);
});

test('a zoomed picture can slide up to the extra size', () => {
  assert.deepEqual(imageViewportPanLimit(2, { width: 400, height: 200 }), {
    maxX: 200,
    maxY: 100,
  });
  assert.deepEqual(
    clampImageViewport({ scale: 2, offsetX: 500, offsetY: -400 }, {
      width: 400,
      height: 200,
    }),
    { scale: 2, offsetX: 200, offsetY: -100 }
  );
});

test('a drag moves the picture and then stops at the edge', () => {
  const zoomed = { scale: 2, offsetX: 0, offsetY: 0 };
  const frame = { width: 400, height: 200 };
  assert.deepEqual(panImageViewport(zoomed, 40, -10, frame), {
    scale: 2,
    offsetX: 40,
    offsetY: -10,
  });
  assert.deepEqual(panImageViewport(zoomed, 800, 0, frame), {
    scale: 2,
    offsetX: 200,
    offsetY: 0,
  });
});

test('zooming toward a point keeps that point under the pointer', () => {
  const frame = { width: 400, height: 200 };
  const next = zoomImageViewport(
    IMAGE_VIEWPORT_RESET,
    2,
    { x: 300, y: 100 },
    frame
  );
  assert.equal(next.scale, 2);
  // Origin is 100 px right of center. Doubling scale without shifting would
  // move that point 100 px further right; the offset pulls it back.
  assert.equal(next.offsetX, -100);
  assert.equal(next.offsetY, 0);
});

test('a wheel up zooms in and a wheel down zooms out', () => {
  assert.ok(imageViewportScaleAfterWheel(1, -200) > 1);
  assert.ok(imageViewportScaleAfterWheel(2, 200) < 2);
  assert.equal(imageViewportScaleAfterWheel(1, 0), 1);
});

test('a pinch scale follows the finger distance', () => {
  assert.equal(imageViewportScaleAfterPinch(2, 100, 150), 3);
  assert.equal(imageViewportScaleAfterPinch(2, 0, 150), 2);
});

test('plus and minus buttons step by a quarter', () => {
  assert.equal(imageViewportScaleAfterStep(1, 1), 1.25);
  assert.equal(imageViewportScaleAfterStep(1.25, -1), 1);
});

test('the CSS transform names the slide and the scale', () => {
  assert.deepEqual(
    imageViewportCssTransform({ scale: 2, offsetX: 12, offsetY: -4 }),
    {
      transform: 'translate(12px, -4px) scale(2)',
      transformOrigin: 'center center',
    }
  );
});

test('zoomed is anything above the fitted picture', () => {
  assert.equal(imageViewportIsZoomed(IMAGE_VIEWPORT_RESET), false);
  assert.equal(imageViewportIsZoomed({ scale: 1.25 }), true);
});

test('pointer distance is the hypotenuse', () => {
  assert.equal(imageViewportPointerDistance(0, 0, 3, 4), 5);
});

test('offsets are kept when the frame size is not known yet', () => {
  assert.deepEqual(
    clampImageViewport({ scale: 2, offsetX: 10, offsetY: -6 }, null),
    { scale: 2, offsetX: 10, offsetY: -6 }
  );
});

test('a stored viewport is read back per key', () => {
  const storage = new Map();
  const memory = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => {
      storage.set(key, value);
    },
  };
  writeImageViewport(
    'voice-stage:maya',
    { scale: 2, offsetX: 10, offsetY: -6 },
    memory
  );
  assert.deepEqual(readImageViewport('voice-stage:maya', memory), {
    scale: 2,
    offsetX: 10,
    offsetY: -6,
  });
  assert.deepEqual(readImageViewport('voice-stage:other', memory), {
    ...IMAGE_VIEWPORT_RESET,
  });
});

test('junk in storage is ignored', () => {
  assert.equal(parseStoredImageViewport(null), null);
  assert.equal(parseStoredImageViewport({ scale: 'nope', offsetX: 1, offsetY: 1 }), null);
  assert.deepEqual(readImageViewport('missing', {
    getItem: () => 'not-json',
  }), IMAGE_VIEWPORT_RESET);
});
