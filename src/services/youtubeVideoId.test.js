import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canonicalYouTubeWatchUrl,
  extractYouTubeVideoIdFromUrl,
  mediaUrlIdentityKey,
  youtubeVideoIdFromHref,
} from './youtubeVideoId.js';

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

test('watch and youtu.be links with tracking params share one identity', () => {
  const watch =
    'https://www.youtube.com/watch?v=lfLKHY52ERc&list=WL&index=54';
  const share = 'https://youtu.be/lfLKHY52ERc?si=0alyoKlhLiZhiDAF';
  assert.equal(youtubeVideoIdFromHref(watch), 'lfLKHY52ERc');
  assert.equal(youtubeVideoIdFromHref(share), 'lfLKHY52ERc');
  assert.equal(mediaUrlIdentityKey(watch), 'youtube:lfLKHY52ERc');
  assert.equal(mediaUrlIdentityKey(share), 'youtube:lfLKHY52ERc');
  assert.equal(
    canonicalYouTubeWatchUrl(watch),
    'https://www.youtube.com/watch?v=lfLKHY52ERc'
  );
  assert.equal(
    canonicalYouTubeWatchUrl(share),
    'https://www.youtube.com/watch?v=lfLKHY52ERc'
  );
});

test('canonicalYouTubeWatchUrl leaves non-YouTube addresses unchanged', () => {
  assert.equal(
    canonicalYouTubeWatchUrl('https://cdn.example.com/talk.mp3'),
    'https://cdn.example.com/talk.mp3'
  );
});
