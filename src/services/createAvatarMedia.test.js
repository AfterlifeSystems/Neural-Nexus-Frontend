import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  applyCreateAvatarMedia,
  createAvatarMediaFromDataTransfer,
  createAvatarVoiceFileKey,
  createAvatarVoiceUrlKey,
  emptyCreateAvatarMedia,
  fileIdentityKey,
  hasCreateAvatarFollowUpMedia,
  isCreateAvatarPortraitUrl,
  isPortraitMediaFile,
  researchHintFromVoiceSources,
  splitCreateAvatarVoiceUploads,
  takeCreateAvatarMediaDraft,
  toggleCreateAvatarReferenceAudio,
} from './createAvatarMedia.js';

test('isPortraitMediaFile accepts still images by MIME type or extension', () => {
  assert.equal(isPortraitMediaFile({ name: 'face.jpg', type: 'image/jpeg' }), true);
  assert.equal(isPortraitMediaFile({ name: 'face.HEIC', type: '' }), true);
  assert.equal(isPortraitMediaFile({ name: 'talk.mp4', type: 'video/mp4' }), false);
  assert.equal(isPortraitMediaFile({ name: 'notes.pdf', type: 'application/pdf' }), false);
});

test('isCreateAvatarPortraitUrl requires an image extension', () => {
  assert.equal(isCreateAvatarPortraitUrl('https://cdn.example.com/face.jpg'), true);
  assert.equal(isCreateAvatarPortraitUrl('https://example.com/about'), false);
  assert.equal(
    isCreateAvatarPortraitUrl('https://www.youtube.com/watch?v=abcdefghijk'),
    false
  );
});

test('applyCreateAvatarMedia splits a mixed drop into portrait, voice, and pages', () => {
  const photo = { name: 'maya.jpg', type: 'image/jpeg', size: 12, lastModified: 1 };
  const voice = { name: 'maya.m4a', type: 'audio/x-m4a', size: 40, lastModified: 2 };
  const page = { name: 'bio.pdf', type: 'application/pdf', size: 8, lastModified: 3 };
  const applied = applyCreateAvatarMedia(emptyCreateAvatarMedia(), {
    files: [photo, voice, page],
    urls: [
      'https://www.youtube.com/watch?v=abcdefghijk',
      'https://example.com/maya.jpg',
      'https://example.com/about',
    ],
  });
  assert.equal(applied.photoFile, null);
  assert.equal(applied.photoUrl, 'https://example.com/maya.jpg');
  assert.deepEqual(
    applied.voiceFiles.map((file) => file.name),
    ['maya.m4a']
  );
  assert.deepEqual(applied.voiceUrls, [
    'https://www.youtube.com/watch?v=abcdefghijk',
  ]);
  assert.deepEqual(
    applied.identityFiles.map((file) => file.name),
    ['bio.pdf']
  );
  assert.deepEqual(applied.identityLinks, ['https://example.com/about']);
  assert.equal(applied.photoReplaced, true);
  assert.equal(applied.addedVoice, 2);
  assert.equal(applied.addedIdentity, 2);
  assert.equal(applied.referenceAudioKey, createAvatarVoiceFileKey(voice));
});

test('a later photograph replaces the portrait and leaves voice samples in place', () => {
  const first = { name: 'one.jpg', type: 'image/jpeg', size: 1, lastModified: 1 };
  const second = { name: 'two.png', type: 'image/png', size: 2, lastModified: 2 };
  const voice = { name: 'clip.wav', type: 'audio/wav', size: 3, lastModified: 3 };
  const started = applyCreateAvatarMedia(emptyCreateAvatarMedia(), {
    files: [first, voice],
  });
  const replaced = applyCreateAvatarMedia(started, { files: [second] });
  assert.equal(replaced.photoFile, second);
  assert.equal(replaced.photoUrl, null);
  assert.equal(replaced.voiceFiles[0], voice);
  assert.equal(replaced.photoReplaced, true);
});

test('duplicate voice files and YouTube variants are not added twice', () => {
  const voice = { name: 'mom.m4a', type: 'audio/x-m4a', size: 9, lastModified: 4 };
  const first = applyCreateAvatarMedia(emptyCreateAvatarMedia(), {
    files: [voice],
    urls: ['https://youtu.be/dQw4w9WgXcQ'],
  });
  const second = applyCreateAvatarMedia(first, {
    files: [voice],
    urls: ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
  });
  assert.equal(second.voiceFiles.length, 1);
  assert.equal(second.voiceUrls.length, 1);
  assert.equal(second.addedVoice, 0);
  assert.equal(fileIdentityKey(voice), 'mom.m4a:9:4');
});

test('takeCreateAvatarMediaDraft classifies a URL and allows an empty field', () => {
  const empty = takeCreateAvatarMediaDraft(emptyCreateAvatarMedia(), '  ');
  assert.equal(empty.error, '');
  assert.equal(empty.leftover, '');

  const voice = takeCreateAvatarMediaDraft(
    emptyCreateAvatarMedia(),
    ' https://cdn.example.com/talk.mp3 '
  );
  assert.equal(voice.error, '');
  assert.deepEqual(voice.media.voiceUrls, ['https://cdn.example.com/talk.mp3']);
  assert.equal(
    voice.media.referenceAudioKey,
    createAvatarVoiceUrlKey('https://cdn.example.com/talk.mp3')
  );

  const blocked = takeCreateAvatarMediaDraft(emptyCreateAvatarMedia(), 'wikipedia');
  assert.equal(blocked.leftover, 'wikipedia');
  assert.match(blocked.error, /clear the field/);
});

test('createAvatarMediaFromDataTransfer reads files and uri-list text', () => {
  const file = { name: 'clip.mp3', type: 'audio/mpeg' };
  const taken = createAvatarMediaFromDataTransfer({
    files: [file],
    getData: (type) =>
      type === 'text/uri-list' ? 'https://example.com/page' : '',
  });
  assert.deepEqual(taken.files, [file]);
  assert.deepEqual(taken.urls, ['https://example.com/page']);
});

test('researchHintFromVoiceSources names the marked reference clip', () => {
  assert.equal(researchHintFromVoiceSources({}), '');
  assert.equal(
    researchHintFromVoiceSources({ files: [{ name: 'mom.m4a' }] }),
    'Reference audio was given for the voice: mom.m4a.'
  );
  assert.equal(
    researchHintFromVoiceSources({
      files: [{ name: 'mom.m4a' }],
      urls: ['https://cdn.example.com/talk.mp3'],
      referenceAudioKey: createAvatarVoiceUrlKey(
        'https://cdn.example.com/talk.mp3'
      ),
    }),
    'Reference audio was given for the voice: https://cdn.example.com/talk.mp3.'
  );
  assert.equal(
    researchHintFromVoiceSources({
      files: [{ name: 'mom.m4a' }],
      referenceAudioKey: '',
    }),
    'Voice media was given: mom.m4a.'
  );
});

test('the first voice item is the reference until another is chosen', () => {
  const file = { name: 'mom.m4a', type: 'audio/x-m4a', size: 4, lastModified: 1 };
  const applied = applyCreateAvatarMedia(emptyCreateAvatarMedia(), {
    files: [file],
    urls: ['https://cdn.example.com/talk.mp3'],
  });
  assert.equal(applied.referenceAudioKey, createAvatarVoiceFileKey(file));
  const switched = toggleCreateAvatarReferenceAudio(
    applied,
    createAvatarVoiceUrlKey('https://cdn.example.com/talk.mp3')
  );
  const split = splitCreateAvatarVoiceUploads(switched);
  assert.equal(split.referenceUrl, 'https://cdn.example.com/talk.mp3');
  assert.deepEqual(
    split.otherFiles.map((voiceFile) => voiceFile.name),
    ['mom.m4a']
  );
  const cleared = toggleCreateAvatarReferenceAudio(
    switched,
    createAvatarVoiceUrlKey('https://cdn.example.com/talk.mp3')
  );
  assert.equal(cleared.referenceAudioKey, '');
  assert.equal(splitCreateAvatarVoiceUploads(cleared).referenceLabel, '');
});

test('hasCreateAvatarFollowUpMedia is true when any item is held', () => {
  assert.equal(hasCreateAvatarFollowUpMedia(emptyCreateAvatarMedia()), false);
  assert.equal(
    hasCreateAvatarFollowUpMedia({
      ...emptyCreateAvatarMedia(),
      voiceUrls: ['https://cdn.example.com/talk.mp3'],
    }),
    true
  );
});
