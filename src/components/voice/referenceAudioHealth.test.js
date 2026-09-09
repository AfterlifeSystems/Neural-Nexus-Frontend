import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  referenceAudioWarning,
  reportsReferenceAudioHealth,
} from './referenceAudioHealth.js';

test('a usable reference clip says nothing', () => {
  assert.equal(
    referenceAudioWarning(
      {
        reference_audio_document: 'Mom.m4a',
        reference_audio_usable: true,
        reference_audio_problem: null,
      },
      'Mom'
    ),
    null
  );
});

test('an avatar with no reference is asked for one', () => {
  const warning = referenceAudioWarning(
    {
      reference_audio_document: null,
      reference_audio_usable: false,
      reference_audio_problem: 'This avatar has no reference audio yet.',
    },
    'Grant'
  );
  assert.match(warning.title, /No reference audio yet/);
  assert.match(warning.detail, /Grant speaks more than anyone else/);
  // The channel-link trap is named, because that is how a bad clip is picked up.
  assert.match(warning.detail, /channel or playlist link/);
});

test('a stored clip that cannot identify the voice names the upload and the reason', () => {
  const warning = referenceAudioWarning(
    {
      reference_audio_document: 'https://www.youtube.com/@imahara',
      reference_audio_usable: false,
      reference_audio_problem:
        'No single speaker stood out in that recording, so no reference clip could be cut from the recording.',
    },
    'Grant'
  );
  assert.match(warning.title, /@imahara/);
  assert.match(warning.detail, /No single speaker stood out/);
  // The owner is told the situation resolves itself on the next good upload.
  assert.match(warning.detail, /next upload that yields a usable clip/);
});

test('a status that reports no health at all is not treated as broken', () => {
  assert.equal(reportsReferenceAudioHealth(null), false);
  assert.equal(reportsReferenceAudioHealth({ collected_seconds: 12 }), false);
  assert.equal(
    reportsReferenceAudioHealth({ reference_audio_usable: false }),
    true
  );
  // Loading, and an older server, both say nothing rather than accusing.
  assert.equal(referenceAudioWarning(null, 'Grant'), null);
  assert.equal(
    referenceAudioWarning({ reference_audio_document: 'Mom.m4a' }, 'Grant'),
    null
  );
});
