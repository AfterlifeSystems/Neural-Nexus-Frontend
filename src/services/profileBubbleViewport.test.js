import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  denormalizeProfileBubbleViewport,
  normalizeProfileBubbleViewport,
  profileBubbleCoverLayout,
  profileBubblePersistKey,
  readProfileBubbleViewport,
  writeProfileBubbleViewport,
} from './profileBubbleViewport.js';

test('the persist key is per avatar', () => {
  assert.equal(profileBubblePersistKey('maya'), 'profile-bubble:maya');
  assert.equal(profileBubblePersistKey(''), null);
});

test('offsets are stored as fractions of the settings tile', () => {
  assert.deepEqual(
    normalizeProfileBubbleViewport(
      { scale: 2, offsetX: 32, offsetY: -16, mediaWidth: 200, mediaHeight: 400 },
      { width: 128, height: 128 }
    ),
    { scale: 2, x: 0.25, y: -0.125, mediaWidth: 200, mediaHeight: 400 }
  );
});

test('the same fractions paint a smaller bubble', () => {
  const stored = { scale: 2, x: 0.25, y: -0.125, mediaWidth: 128, mediaHeight: 256 };
  const small = { width: 32, height: 32 };
  const viewport = denormalizeProfileBubbleViewport(stored, small);
  assert.equal(viewport.scale, 2);
  assert.equal(viewport.offsetX, 8);
  assert.equal(viewport.offsetY, -4);
  const layout = profileBubbleCoverLayout(viewport, {
    ...small,
    mediaWidth: 128,
    mediaHeight: 256,
  });
  assert.equal(layout.width, 64);
  assert.equal(layout.height, 128);
});

test('a stored bubble crop is read back for that avatar', () => {
  const storage = new Map();
  const memory = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => {
      storage.set(key, value);
    },
  };
  writeProfileBubbleViewport(
    'maya',
    { scale: 1.5, offsetX: 10, offsetY: -8, mediaWidth: 300, mediaHeight: 400 },
    { width: 128, height: 128, mediaWidth: 300, mediaHeight: 400 },
    memory
  );
  const read = readProfileBubbleViewport('maya', { width: 128, height: 128 }, memory);
  assert.equal(read.scale, 1.5);
  assert.ok(Math.abs(read.offsetX - 10) < 1e-9);
  assert.ok(Math.abs(read.offsetY + 8) < 1e-9);
  const other = readProfileBubbleViewport('other', { width: 128, height: 128 }, memory);
  assert.equal(other.scale, 1);
  assert.equal(other.offsetX, 0);
  assert.equal(other.offsetY, 0);
});
