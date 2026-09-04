import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  extractYouTubeVideoIdFromUrl,
  looksLikeReferenceAudioUrl,
  singleReferenceAudioUrl,
} from './referenceAudioUrl.js';

test('extractYouTubeVideoIdFromUrl reads watch, short, and youtu.be links', () => {
  assert.equal(
    extractYouTubeVideoIdFromUrl(
      new URL('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    ),
    'dQw4w9WgXcQ'
  );
  assert.equal(
    extractYouTubeVideoIdFromUrl(new URL('https://youtu.be/dQw4w9WgXcQ')),
    'dQw4w9WgXcQ'
  );
  assert.equal(
    extractYouTubeVideoIdFromUrl(
      new URL('https://youtube.com/shorts/dQw4w9WgXcQ')
    ),
    'dQw4w9WgXcQ'
  );
  assert.equal(
    extractYouTubeVideoIdFromUrl(
      new URL('https://www.youtube.com/playlist?list=PLxxxxx')
    ),
    null
  );
});

test('looksLikeReferenceAudioUrl accepts YouTube videos and direct media', () => {
  assert.equal(
    looksLikeReferenceAudioUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
    true
  );
  assert.equal(
    looksLikeReferenceAudioUrl('https://cdn.example.com/talk.mp4'),
    true
  );
  assert.equal(
    looksLikeReferenceAudioUrl('https://cdn.example.com/voice.mp3'),
    true
  );
  assert.equal(looksLikeReferenceAudioUrl('https://example.com/article'), false);
  assert.equal(
    looksLikeReferenceAudioUrl('https://www.youtube.com/playlist?list=PLxxxxx'),
    false
  );
  assert.equal(looksLikeReferenceAudioUrl('not a url'), false);
});

test('singleReferenceAudioUrl requires exactly one http(s) URL', () => {
  assert.deepEqual(singleReferenceAudioUrl(''), {
    error: 'Enter an http:// or https:// video or audio URL',
  });
  assert.deepEqual(
    singleReferenceAudioUrl('https://youtu.be/dQw4w9WgXcQ'),
    { url: 'https://youtu.be/dQw4w9WgXcQ' }
  );
  assert.deepEqual(
    singleReferenceAudioUrl(
      'https://youtu.be/aaaaaaaaaaa https://youtu.be/bbbbbbbbbbb'
    ),
    { error: 'Voice reference needs a single URL' }
  );
});
