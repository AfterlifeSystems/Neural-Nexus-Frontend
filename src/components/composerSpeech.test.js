import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appendSpokenTranscript } from './composerSpeech.js';

test('transcribed words land in an empty box', () => {
  assert.equal(appendSpokenTranscript('', 'Hello there'), 'Hello there');
  assert.equal(appendSpokenTranscript('  ', 'Hello'), 'Hello');
});

test('a later utterance is appended to what is already typed', () => {
  assert.equal(appendSpokenTranscript('Hello', 'there'), 'Hello there');
  assert.equal(appendSpokenTranscript('Hello ', 'there'), 'Hello there');
});

test('empty transcription leaves the draft alone', () => {
  assert.equal(appendSpokenTranscript('Hello', ''), 'Hello');
  assert.equal(appendSpokenTranscript('Hello', '   '), 'Hello');
});
