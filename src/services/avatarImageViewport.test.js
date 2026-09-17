import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assistantIdOfAvatar,
  imageViewportFromAvatar,
  parseAvatarImageViewport,
  rememberAvatarImageViewport,
  rememberImageViewportsFromAvatars,
  rememberedAvatarImageViewport,
  resetAvatarImageViewportMemoryForTests,
  resolveProfileBubbleViewport,
} from './avatarImageViewport.js';
import {
  readProfileBubbleViewport,
  writeProfileBubbleViewport,
} from './profileBubbleViewport.js';

test('a stored crop is read from metadata or a lifted public field', () => {
  const crop = { scale: 2, x: 0.2, y: -0.1, mediaWidth: 200, mediaHeight: 400 };
  assert.deepEqual(
    imageViewportFromAvatar({ metadata: { image_viewport: crop } }),
    crop
  );
  assert.deepEqual(imageViewportFromAvatar({ image_viewport: crop }), crop);
  assert.equal(imageViewportFromAvatar({ metadata: {} }), null);
  assert.equal(imageViewportFromAvatar(null), null);
});

test('snake_case media size from the API is accepted', () => {
  assert.deepEqual(
    parseAvatarImageViewport({
      scale: 1.5,
      x: 0,
      y: 0,
      media_width: 80,
      media_height: 120,
    }),
    { scale: 1.5, x: 0, y: 0, mediaWidth: 80, mediaHeight: 120 }
  );
});

test('remembered crops are keyed by the avatar', () => {
  resetAvatarImageViewportMemoryForTests();
  rememberImageViewportsFromAvatars([
    {
      assistant_id: 'maya',
      metadata: { image_viewport: { scale: 2, x: 0.1, y: 0 } },
    },
    { avatar_id: 'other' },
  ]);
  assert.deepEqual(rememberedAvatarImageViewport('maya'), {
    scale: 2,
    x: 0.1,
    y: 0,
  });
  assert.equal(rememberedAvatarImageViewport('other'), null);
  rememberAvatarImageViewport('maya', { scale: 3, x: 0, y: 0 });
  assert.equal(rememberedAvatarImageViewport('maya').scale, 3);
  assert.equal(assistantIdOfAvatar({ assistant_id: 'ava/1' }), 'ava/1');
});

test('resolve falls back to the remembered crop when localStorage is default', () => {
  resetAvatarImageViewportMemoryForTests();
  const storage = new Map();
  const memory = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => {
      storage.set(key, value);
    },
  };
  rememberAvatarImageViewport('maya', {
    scale: 2,
    x: 0.25,
    y: -0.125,
    mediaWidth: 200,
    mediaHeight: 400,
  });
  const frame = { width: 32, height: 32, mediaWidth: 200, mediaHeight: 400 };
  const resolved = resolveProfileBubbleViewport('maya', frame, memory);
  assert.equal(resolved.scale, 2);
  assert.ok(Math.abs(resolved.offsetX - 8) < 1e-9);
  assert.ok(Math.abs(resolved.offsetY + 4) < 1e-9);
});

test('resolve keeps a framed localStorage crop over the remembered one', () => {
  resetAvatarImageViewportMemoryForTests();
  const storage = new Map();
  const memory = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => {
      storage.set(key, value);
    },
  };
  writeProfileBubbleViewport(
    'maya',
    { scale: 1.5, offsetX: 10, offsetY: -8, mediaWidth: 200, mediaHeight: 400 },
    { width: 128, height: 128, mediaWidth: 200, mediaHeight: 400 },
    memory
  );
  rememberAvatarImageViewport('maya', { scale: 3, x: 0.5, y: 0.5 });
  const resolved = resolveProfileBubbleViewport(
    'maya',
    { width: 128, height: 128 },
    memory
  );
  assert.equal(resolved.scale, 1.5);
  assert.ok(Math.abs(resolved.offsetX - 10) < 1e-9);
});

test('remembering avatars seeds localStorage when the browser has no crop', () => {
  resetAvatarImageViewportMemoryForTests();
  const storage = new Map();
  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => {
      storage.set(key, value);
    },
  };
  try {
    rememberImageViewportsFromAvatars([
      {
        assistant_id: 'maya',
        metadata: {
          image_viewport: {
            scale: 2,
            x: 0.25,
            y: -0.125,
            mediaWidth: 200,
            mediaHeight: 400,
          },
        },
      },
    ]);
    const read = readProfileBubbleViewport('maya', { width: 128, height: 128 });
    assert.equal(read.scale, 2);
    assert.ok(Math.abs(read.offsetX - 32) < 1e-9);
    assert.ok(Math.abs(read.offsetY + 16) < 1e-9);
  } finally {
    globalThis.localStorage = previous;
  }
});
