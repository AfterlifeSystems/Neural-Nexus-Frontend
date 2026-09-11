// src/components/avatarAudioGate.js
//
// The one question the microphone is opened by: is the avatar audible right now?
//
// This is a named, tested predicate rather than an expression inside the voice
// screen because getting it wrong has now produced the same bug twice, and the
// bug is a bad one — the avatar records its own voice, transcribes it, and
// answers itself, so the conversation walks in a circle and the person's own
// words are cut off by the reply to an echo.
//
// The first time, a stale callback re-opened the microphone after a newer reply
// had shut it. That was fixed by deriving the gate from state instead of
// pausing and resuming the microphone from scattered callbacks.
//
// The second time, scene narration began speaking through its own audio path —
// so that it can fall back to the browser's voice when the avatar has no clone
// — and none of the three things the gate looked at knew anything about it. The
// microphone stayed open through every description and transcribed them.
//
// The lesson both times is the same: ANY path that can put the avatar's voice
// through the speakers has to be an argument here. Adding a fourth way for the
// avatar to speak without adding it to this function reproduces the bug.

/**
 * Whether the avatar's voice is, or is about to be, coming out of the speakers.
 *
 * @param {Object} sources Every way the avatar can be audible.
 * @param {boolean} [sources.isPlayingReply] A live reply is playing.
 * @param {boolean} [sources.isSpeaking] An utterance is playing through
 *   `useSpeech` — a reply, or a line the person pressed play on.
 * @param {string|null} [sources.loadingSpeechKey] An utterance has been asked
 *   for and its audio is still being fetched. Counted as audible: the gate has
 *   to close BEFORE the sound arrives, not when it does.
 * @param {boolean} [sources.sceneNarrationSpeaking] A scene description is
 *   being read aloud (the accessibility mode). It plays through its own path,
 *   which is exactly why it has to be named here.
 * @returns {boolean}
 */
export function avatarIsAudible({
  isPlayingReply = false,
  isSpeaking = false,
  loadingSpeechKey = null,
  sceneNarrationSpeaking = false,
} = {}) {
  return Boolean(
    isPlayingReply ||
      isSpeaking ||
      loadingSpeechKey !== null ||
      sceneNarrationSpeaking
  );
}

export default avatarIsAudible;
