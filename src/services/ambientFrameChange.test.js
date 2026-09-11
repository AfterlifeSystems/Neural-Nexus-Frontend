import test from 'node:test';
import assert from 'node:assert/strict';
import {
  frameDifference,
  frameSignatureFromPixels,
  isFrameMateriallyDifferent,
  shouldSendCapturedFrame,
} from './ambientCaptureScheduler.js';

/** Build an RGBA buffer of one flat grey value. */
const flatFrame = (value, pixels = 16) => {
  const buffer = new Uint8ClampedArray(pixels * 4);
  for (let index = 0; index < pixels; index += 1) {
    buffer[index * 4] = value;
    buffer[index * 4 + 1] = value;
    buffer[index * 4 + 2] = value;
    buffer[index * 4 + 3] = 255;
  }
  return buffer;
};

test('a signature is one brightness byte per pixel', () => {
  const signature = frameSignatureFromPixels(flatFrame(120, 4));
  assert.equal(signature.length, 4);
  assert.equal(signature[0], 120);
});

test('an identical frame differs by nothing', () => {
  const first = frameSignatureFromPixels(flatFrame(100));
  const second = frameSignatureFromPixels(flatFrame(100));
  assert.equal(frameDifference(first, second), 0);
  assert.equal(
    isFrameMateriallyDifferent({ previous: first, next: second, threshold: 0.035 }),
    false
  );
});

test('sensor noise does not read as the scene changing', () => {
  const still = frameSignatureFromPixels(flatFrame(100));
  const noisy = frameSignatureFromPixels(flatFrame(102));
  assert.ok(frameDifference(still, noisy) < 0.035);
  assert.equal(
    isFrameMateriallyDifferent({ previous: still, next: noisy, threshold: 0.035 }),
    false
  );
});

test('a real change in the scene reads as different', () => {
  const dark = frameSignatureFromPixels(flatFrame(40));
  const bright = frameSignatureFromPixels(flatFrame(200));
  assert.ok(frameDifference(dark, bright) > 0.035);
  assert.equal(
    isFrameMateriallyDifferent({ previous: dark, next: bright, threshold: 0.035 }),
    true
  );
});

test('the first frame of a share is always worth sending', () => {
  const first = frameSignatureFromPixels(flatFrame(100));
  assert.equal(
    isFrameMateriallyDifferent({ previous: null, next: first, threshold: 0.035 }),
    true
  );
});

test('an unchanged scene is not sent until the heartbeat is due', () => {
  const signature = frameSignatureFromPixels(flatFrame(100));
  const base = {
    previousSignature: signature,
    nextSignature: signature,
    threshold: 0.035,
    heartbeatMs: 600_000,
  };
  assert.equal(
    shouldSendCapturedFrame({ ...base, lastSentAt: 1_000_000, now: 1_060_000 }),
    false
  );
  assert.equal(
    shouldSendCapturedFrame({ ...base, lastSentAt: 1_000_000, now: 1_700_000 }),
    true
  );
});

test('with the heartbeat off an unchanged scene is never sent', () => {
  const signature = frameSignatureFromPixels(flatFrame(100));
  assert.equal(
    shouldSendCapturedFrame({
      previousSignature: signature,
      nextSignature: signature,
      threshold: 0.035,
      lastSentAt: 1_000_000,
      heartbeatMs: 0,
      now: 9_000_000,
    }),
    false
  );
});
