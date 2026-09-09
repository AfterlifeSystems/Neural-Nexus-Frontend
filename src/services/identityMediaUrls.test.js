import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  collapseDuplicateIdentityDocuments,
  resolveIdentityMediaUrls,
} from './identityMediaUrls.js';

test('resolveIdentityMediaUrls canonicalises YouTube and drops the same clip twice', () => {
  assert.deepEqual(
    resolveIdentityMediaUrls([
      'https://www.youtube.com/watch?v=lfLKHY52ERc&list=WL&index=54',
      'https://youtu.be/lfLKHY52ERc?si=0alyoKlhLiZhiDAF',
    ]),
    ['https://www.youtube.com/watch?v=lfLKHY52ERc']
  );
});

test('resolveIdentityMediaUrls reuses the first stored label for a duplicate clip', () => {
  const existing = [
    {
      label: 'https://www.youtube.com/watch?v=lfLKHY52ERc&list=WL&index=54',
      isReferenceAudio: true,
    },
  ];
  assert.deepEqual(
    resolveIdentityMediaUrls(
      ['https://youtu.be/lfLKHY52ERc?si=0alyoKlhLiZhiDAF'],
      existing
    ),
    ['https://www.youtube.com/watch?v=lfLKHY52ERc&list=WL&index=54']
  );
});

test('collapseDuplicateIdentityDocuments keeps the first row and merges voice marks', () => {
  const collapsed = collapseDuplicateIdentityDocuments([
    {
      label: 'https://www.youtube.com/watch?v=lfLKHY52ERc&list=WL&index=54',
      isReferenceAudio: true,
      isReferenceImage: false,
      inVoiceCorpus: false,
      voiceSeconds: 0,
      referenceRole: 'reference_audio',
    },
    {
      label: 'https://youtu.be/lfLKHY52ERc?si=0alyoKlhLiZhiDAF',
      isReferenceAudio: false,
      isReferenceImage: false,
      inVoiceCorpus: true,
      voiceSeconds: 206,
      referenceRole: null,
    },
  ]);
  assert.equal(collapsed.length, 1);
  assert.equal(
    collapsed[0].label,
    'https://www.youtube.com/watch?v=lfLKHY52ERc&list=WL&index=54'
  );
  assert.equal(collapsed[0].isReferenceAudio, true);
  assert.equal(collapsed[0].inVoiceCorpus, true);
  assert.equal(collapsed[0].voiceSeconds, 206);
  assert.deepEqual(collapsed[0].sourceLabels, [
    'https://www.youtube.com/watch?v=lfLKHY52ERc&list=WL&index=54',
    'https://youtu.be/lfLKHY52ERc?si=0alyoKlhLiZhiDAF',
  ]);
});

test('collapseDuplicateIdentityDocuments leaves distinct sources apart', () => {
  const collapsed = collapseDuplicateIdentityDocuments([
    { label: 'https://youtu.be/aaaaaaaaaaa' },
    { label: 'https://youtu.be/bbbbbbbbbbb' },
    { label: 'notes.pdf' },
  ]);
  assert.equal(collapsed.length, 3);
});
