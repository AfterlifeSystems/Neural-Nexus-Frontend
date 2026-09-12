// src/services/avatarSpeechUnlock.js
//
// Mobile browsers (Safari on iPhone especially) refuse HTMLAudioElement.play()
// unless that element has already played during a user gesture. Live voice
// replies call POST /speak and only then create audio, which is no longer
// inside the tap that sent the turn. A new Audio() at that moment is silent:
// play() rejects with NotAllowedError, and treating that as "ended" looks like
// the avatar finished speaking when it never started.
//
// The fix is the same shape as primeLocalVoice() for speechSynthesis: play
// silence on one element during the tap that opens voice mode / sends a turn,
// then reuse that element for every cloned-voice utterance.

/** One-sample silent WAV so prime() has something the element can play. */
const SILENT_WAV_DATA_URL =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

let unlockedSpeechElement = null;

/**
 * Whether a play() rejection is the mobile autoplay gate, not a bad file.
 *
 * @param {Error|null|undefined} playError
 * @returns {boolean}
 */
export function isSpeechPlayBlocked(playError) {
  return playError?.name === 'NotAllowedError';
}

/**
 * The element that was primed, if any.
 *
 * @returns {HTMLAudioElement|null}
 */
export function primedSpeechElement() {
  return unlockedSpeechElement;
}

/**
 * Whether this is the element that was unlocked during a gesture.
 *
 * @param {HTMLAudioElement|null|undefined} audio
 * @returns {boolean}
 */
export function isUnlockedSpeechElement(audio) {
  return Boolean(unlockedSpeechElement && audio === unlockedSpeechElement);
}

/**
 * Unlock HTML audio from inside a tap, so a later cloned-voice reply can play.
 *
 * Safe to call often: a second prime on an already-playing utterance does not
 * replace the source.
 *
 * @returns {boolean} Whether an element was asked to play.
 */
export function primeAvatarSpeechPlayback() {
  if (typeof Audio === 'undefined') return false;
  if (!unlockedSpeechElement) {
    unlockedSpeechElement = new Audio();
  }
  const audio = unlockedSpeechElement;
  try {
    if (!audio.paused && audio.src && !audio.src.startsWith('data:')) {
      return true;
    }
    audio.muted = true;
    audio.volume = 0;
    if (audio.src !== SILENT_WAV_DATA_URL) {
      audio.src = SILENT_WAV_DATA_URL;
    }
    const playAttempt = audio.play();
    if (playAttempt && typeof playAttempt.catch === 'function') {
      playAttempt.catch(() => {
        // A prime that the browser still refuses leaves the later utterance
        // to report NotAllowedError; the caller then keeps the words on screen.
      });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Point the unlocked element at this object URL and return it for playback.
 *
 * @param {string} objectUrl
 * @returns {HTMLAudioElement}
 */
export function playOnUnlockedSpeechElement(objectUrl) {
  const audio = unlockedSpeechElement ?? new Audio();
  if (!unlockedSpeechElement) unlockedSpeechElement = audio;
  audio.muted = false;
  audio.volume = 1;
  audio.src = objectUrl;
  return audio;
}

/**
 * Drop the primed element. Tests only.
 *
 * @returns {void}
 */
export function resetAvatarSpeechUnlockForTests() {
  if (unlockedSpeechElement) {
    try {
      unlockedSpeechElement.pause();
      unlockedSpeechElement.src = '';
    } catch {
      // An element the test already tore down is fine.
    }
  }
  unlockedSpeechElement = null;
}
