import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  isVoiceMediaFile,
  isVoiceMediaFilename,
  isVoiceMediaUrl,
  splitVoiceMedia,
} from './voiceMedia.js';

test('audio and video files are voice media, by MIME type or extension', () => {
  assert.equal(isVoiceMediaFile({ name: 'Mom.m4a', type: 'audio/x-m4a' }), true);
  assert.equal(isVoiceMediaFile({ name: 'talk.mp4', type: 'video/mp4' }), true);
  assert.equal(isVoiceMediaFile({ name: 'Mom.m4a', type: '' }), true);
  assert.equal(isVoiceMediaFile({ name: 'resume.pdf', type: 'application/pdf' }), false);
  assert.equal(isVoiceMediaFile({ name: 'notes', type: '' }), false);
  assert.equal(isVoiceMediaFilename('interview.MOV'), true);
  assert.equal(isVoiceMediaFilename('photo.png'), false);
});

test('YouTube links and direct media addresses are voice media URLs', () => {
  assert.equal(isVoiceMediaUrl('https://www.youtube.com/watch?v=abcdefghijk'), true);
  assert.equal(isVoiceMediaUrl('https://cdn.example.com/talk.mp3'), true);
  assert.equal(isVoiceMediaUrl('https://example.com/article'), false);
});

test('a mixed batch splits into voice media and documents', () => {
  const split = splitVoiceMedia({
    files: [
      { name: 'Mom.m4a', type: 'audio/x-m4a' },
      { name: 'resume.pdf', type: 'application/pdf' },
    ],
    urls: ['https://youtu.be/abcdefghijk', 'https://example.com/post'],
  });
  assert.deepEqual(
    split.voiceFiles.map((file) => file.name),
    ['Mom.m4a']
  );
  assert.deepEqual(
    split.otherFiles.map((file) => file.name),
    ['resume.pdf']
  );
  assert.deepEqual(split.voiceUrls, ['https://youtu.be/abcdefghijk']);
  assert.deepEqual(split.otherUrls, ['https://example.com/post']);
});
