import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describeVoiceUploadFailure } from './voiceUploadOutcome.js';

test('a Voice-section batch that added speech is not a failure', () => {
  assert.equal(
    describeVoiceUploadFailure({ voice_seconds_collected: 76, items: [] }),
    null
  );
});

test('a Voice-section batch that added nothing reports the item errors', () => {
  assert.equal(
    describeVoiceUploadFailure({
      voice_seconds_collected: 0,
      items: [
        { status: 'error', error: 'No speech of Claire Wineland was found' },
        { status: 'completed', error: null },
      ],
    }),
    'No speech of Claire Wineland was found'
  );
});

test('a Voice-section batch that added nothing without errors still says so', () => {
  assert.equal(
    describeVoiceUploadFailure({ voice_seconds_collected: 0, items: [] }),
    'No speech was added to the voice from this upload.'
  );
});

test('a batch from a server without voice figures is left alone', () => {
  assert.equal(describeVoiceUploadFailure({ items: [] }), null);
  assert.equal(describeVoiceUploadFailure(null), null);
});
