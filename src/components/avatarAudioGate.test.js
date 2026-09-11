import assert from 'node:assert/strict';
import { test } from 'node:test';

import { avatarIsAudible } from './avatarAudioGate.js';

test('a silent avatar lets the microphone open', () => {
  assert.equal(avatarIsAudible(), false);
  assert.equal(avatarIsAudible({ loadingSpeechKey: null }), false);
});

test('each way the avatar can speak closes the microphone', () => {
  assert.equal(avatarIsAudible({ isPlayingReply: true }), true);
  assert.equal(avatarIsAudible({ isSpeaking: true }), true);
  assert.equal(avatarIsAudible({ loadingSpeechKey: 'live-reply' }), true);
  assert.equal(avatarIsAudible({ sceneNarrationSpeaking: true }), true);
});

test('a scene description being read aloud closes the microphone', () => {
  // The regression this file exists for. Narration speaks through its own
  // audio path so it can fall back to the browser's voice; while it did not
  // reach this gate, the microphone recorded the description, transcribed a
  // fragment of it, and sent it back as if the person had said it — and the
  // reply to that echo cut the avatar off mid-sentence.
  assert.equal(
    avatarIsAudible({
      isPlayingReply: false,
      isSpeaking: false,
      loadingSpeechKey: null,
      sceneNarrationSpeaking: true,
    }),
    true
  );
});

test('audio being fetched counts before a sound is made', () => {
  // The gate has to shut before the speakers start, not when they do.
  assert.equal(avatarIsAudible({ loadingSpeechKey: 'message-7' }), true);
});
