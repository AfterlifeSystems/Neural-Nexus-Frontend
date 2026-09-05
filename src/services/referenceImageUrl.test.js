import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  looksLikeReferenceImageUrl,
  singleReferenceImageUrl,
} from './referenceImageUrl.js';

test('looksLikeReferenceImageUrl accepts direct images and extension-less CDNs', () => {
  assert.equal(
    looksLikeReferenceImageUrl('https://cdn.example.com/face.jpg'),
    true
  );
  assert.equal(
    looksLikeReferenceImageUrl('https://cdn.example.com/face.PNG?w=512'),
    true
  );
  assert.equal(
    looksLikeReferenceImageUrl('https://cdn.example.com/face.webp'),
    true
  );
  assert.equal(
    looksLikeReferenceImageUrl('https://avatars.githubusercontent.com/u/1?v=4'),
    true
  );
  assert.equal(
    looksLikeReferenceImageUrl('https://images.unsplash.com/photo-123'),
    true
  );
  assert.equal(looksLikeReferenceImageUrl('https://example.com/article.pdf'), false);
  assert.equal(looksLikeReferenceImageUrl('https://cdn.example.com/talk.mp3'), false);
  assert.equal(
    looksLikeReferenceImageUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
    false
  );
  assert.equal(looksLikeReferenceImageUrl('not a url'), false);
});

test('singleReferenceImageUrl requires exactly one image URL', () => {
  assert.deepEqual(singleReferenceImageUrl(''), {
    error: 'Enter an http:// or https:// image URL',
  });
  assert.deepEqual(singleReferenceImageUrl('https://cdn.example.com/face.png'), {
    url: 'https://cdn.example.com/face.png',
  });
  assert.deepEqual(
    singleReferenceImageUrl(
      'https://cdn.example.com/a.jpg https://cdn.example.com/b.jpg'
    ),
    { error: 'Add one portrait URL at a time' }
  );
  assert.deepEqual(singleReferenceImageUrl('https://cdn.example.com/talk.mp3'), {
    error:
      'That address is audio or video. Add it under Voice, not as the portrait.',
  });
  assert.deepEqual(singleReferenceImageUrl('https://example.com/notes.pdf'), {
    error:
      'Only a direct image URL can be the portrait — a .jpg, .png, .webp, or an image CDN link',
  });
  assert.deepEqual(
    singleReferenceImageUrl('https://avatars.githubusercontent.com/u/1?v=4'),
    { url: 'https://avatars.githubusercontent.com/u/1?v=4' }
  );
});
