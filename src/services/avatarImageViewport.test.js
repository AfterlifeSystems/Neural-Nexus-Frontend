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
} from './avatarImageViewport.js';

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
