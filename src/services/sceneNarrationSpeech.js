// src/services/sceneNarrationSpeech.js
//
// Saying a scene description out loud.
//
// Everywhere else in the product, hearing the avatar is a nicety: the words are
// on screen and the voice is the pleasant way to receive them. Scene narration
// is the one place where the voice IS the product — the person it is built for
// cannot read the screen, so a description that is not spoken was not
// delivered. That single fact is why this file exists rather than reusing
// `useSpeech`.
//
// Two consequences follow from it.
//
// **Speaking must never depend on the avatar having a cloned voice.** The
// avatar's own voice is tried first, because hearing the avatar is the whole
// point of the avatar; but a missing clone, a clone the vendor has banned, a
// server with no voice stack, an expired session, a dropped network — none of
// those may end with a blind person standing in a street hearing nothing. The
// browser's own speech synthesis is always there, it is what a screen-reader
// user already relies on, and it answers in milliseconds. So it is the
// fallback, and it is silent about being one.
//
// **One utterance at a time, and the newest wins.** Descriptions arrive every
// few seconds. A queue would put the person further and further behind what
// the camera is actually pointed at, which for someone walking is worse than
// useless — it is misleading. So starting an utterance ends the one before it.

import { rememberAvatarSpokenLine } from './selfEchoGuard.js';

// The avatar's voice is fetched through the API client, which is loaded only
// when an utterance actually needs it. Two reasons: this module is reached on
// screens that never speak, and the browser-voice half below must stay
// loadable on its own — it is the half that has to work when everything else
// has failed, and it is the half the tests exercise.
async function avatarSpeechEndpoint() {
  const { speakText } = await import('./avatarService');
  return speakText;
}

/** The utterance playing now, whichever way it is being produced. */
let playingAudio = null;
let playingObjectUrl = null;
let inFlightRequest = null;

/**
 * Whether this browser can speak at all without the API.
 *
 * @returns {boolean}
 */
export function canSpeakLocally() {
  return (
    typeof globalThis.speechSynthesis !== 'undefined' &&
    typeof globalThis.SpeechSynthesisUtterance === 'function'
  );
}

/**
 * Unlock this browser's speech synthesis, from inside a press.
 *
 * Several browsers refuse to speak until a gesture has happened, and the
 * fallback voice is no use if it is locked at the moment it is needed. Speaking
 * one silent utterance during the press that switches the mode on leaves the
 * fallback usable for the rest of the session, whether or not it is ever used.
 *
 * @returns {void}
 */
export function primeLocalVoice() {
  if (!canSpeakLocally()) return;
  try {
    const silence = new globalThis.SpeechSynthesisUtterance(' ');
    silence.volume = 0;
    globalThis.speechSynthesis.speak(silence);
  } catch {
    // A browser that will not take a silent utterance is a browser that was
    // never going to need unlocking.
  }
}

/**
 * Stop whatever is being said right now.
 *
 * Called when the mode is switched off, when the person starts talking, and
 * before every new description — so the voice is never behind the camera.
 *
 * @returns {void}
 */
export function stopNarrationSpeech() {
  inFlightRequest?.abort();
  inFlightRequest = null;
  if (playingAudio) {
    playingAudio.pause();
    playingAudio.src = '';
    playingAudio = null;
  }
  if (playingObjectUrl) {
    URL.revokeObjectURL(playingObjectUrl);
    playingObjectUrl = null;
  }
  try {
    globalThis.speechSynthesis?.cancel();
  } catch {
    // A browser that refuses to cancel is a browser that was not speaking.
  }
}

/**
 * Say one line with the browser's own voice.
 *
 * @param {string} text
 * @param {Object} [options]
 * @param {number} [options.rate] Speaking rate; narration runs slightly fast
 *   because the next description is already on its way.
 * @returns {Promise<boolean>} Whether the line was spoken.
 */
export function speakLocally(text, { rate = 1.05 } = {}) {
  const words = String(text ?? '').trim();
  if (!words || !canSpeakLocally()) return Promise.resolve(false);
  return new Promise((resolve) => {
    try {
      const utterance = new globalThis.SpeechSynthesisUtterance(words);
      utterance.rate = rate;
      let settled = false;
      const finish = (spoken) => {
        if (settled) return;
        settled = true;
        resolve(spoken);
      };
      utterance.addEventListener('end', () => finish(true), { once: true });
      utterance.addEventListener('error', () => finish(false), { once: true });
      globalThis.speechSynthesis.speak(utterance);
      // Some browsers drop an utterance queued while the tab is busy and fire
      // no event at all. The loop must not wedge on a promise that never
      // settles, so an utterance that has said nothing by the time it could
      // plausibly have finished is treated as spoken and the loop moves on.
      const generousMilliseconds = 2000 + words.length * 90;
      setTimeout(() => finish(true), generousMilliseconds);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Say one line out loud: the avatar's voice if it has one, this browser's if not.
 *
 * @param {string} assistantId The avatar doing the describing.
 * @param {string} text The description.
 * @param {Object} [options]
 * @param {boolean} [options.asAnonymousIdentity] Public chat: withhold the credential.
 * @param {boolean} [options.preferLocalVoice] Skip the avatar's voice entirely.
 *   The Accessibility page offers this: the cloned voice costs a round trip per
 *   description, and a person who wants the fastest possible narration — or who
 *   simply prefers their own screen-reader voice — should be able to have it.
 * @returns {Promise<'avatar'|'browser'|'silent'>} How the line was said.
 */
export async function speakNarration(
  assistantId,
  text,
  { asAnonymousIdentity = false, preferLocalVoice = false } = {}
) {
  const words = String(text ?? '').trim();
  if (!words) return 'silent';
  stopNarrationSpeech();

  if (!preferLocalVoice && assistantId) {
    const controller = new AbortController();
    inFlightRequest = controller;
    try {
      const speakText = await avatarSpeechEndpoint();
      const audioBlob = await speakText(assistantId, words, {
        asAnonymousIdentity,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return 'silent';
      const objectUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(objectUrl);
      playingObjectUrl = objectUrl;
      playingAudio = audio;
      // A microphone listening in the same room will hear this. Remembering it
      // is what stops live voice mode transcribing the avatar's own
      // description and answering it as though the person had said it.
      rememberAvatarSpokenLine(words);
      await new Promise((resolve) => {
        const finish = () => {
          if (playingAudio === audio) {
            playingAudio = null;
          }
          if (playingObjectUrl === objectUrl) {
            URL.revokeObjectURL(objectUrl);
            playingObjectUrl = null;
          }
          resolve();
        };
        audio.addEventListener('ended', finish, { once: true });
        audio.addEventListener('error', finish, { once: true });
        audio.play().catch(finish);
      });
      return 'avatar';
    } catch (avatarVoiceError) {
      // Deliberately quiet to the person, and deliberately not a toast. Every
      // reason the avatar's voice can fail — no clone yet, a clone the vendor
      // banned, no voice stack on the server, a flaky network — has the same
      // answer here: say the words with the voice that is definitely
      // available. A person relying on this to cross a room does not need to
      // be told which voice is speaking, only what is in front of them.
      //
      // Not quiet to the console, though. The avatar's own voice is what this
      // is meant to sound like, and a silent fallback is exactly the kind of
      // fault that gets noticed as "why is it reading to me in a robot voice"
      // with nothing anywhere to say why.
      if (controller.signal.aborted) return 'silent';
      console.warn(
        'Scene narration fell back to this browser\'s voice; the avatar\'s voice could not be fetched:',
        avatarVoiceError
      );
    } finally {
      if (inFlightRequest === controller) inFlightRequest = null;
    }
  }

  const spoken = await speakLocally(words);
  return spoken ? 'browser' : 'silent';
}

/**
 * Say one short line about the mode itself, the moment the switch is flipped.
 *
 * In the avatar's own voice when there is an avatar, because everything else
 * this mode says is in the avatar's voice and the confirmation should not be
 * the one line that sounds like a different program. The browser's voice is
 * the fallback here exactly as it is for a description.
 *
 * The browser's voice is also PRIMED here, inside the press, whichever voice
 * ends up speaking: the unlock some browsers require has to happen during a
 * gesture, and switching the mode on is the last gesture before descriptions
 * start arriving on their own.
 *
 * @param {boolean} enabled Which way the switch was just flipped.
 * @param {Object} [options]
 * @param {string} [options.avatarName] Named when the mode goes on.
 * @param {string} [options.assistantId] The avatar to say it, if there is one.
 * @param {boolean} [options.asAnonymousIdentity] Public chat: withhold the credential.
 * @returns {Promise<'avatar'|'browser'|'silent'>}
 */
export function announceSceneNarration(
  enabled,
  { avatarName, assistantId, asAnonymousIdentity = false } = {}
) {
  const line = enabled
    ? `Describing your surroundings${avatarName ? ` with ${avatarName}` : ''}. Point your camera at what is in front of you.`
    : 'Surroundings descriptions stopped.';
  if (!enabled) stopNarrationSpeech();
  primeLocalVoice();
  if (!assistantId) {
    return speakLocally(line, { rate: 1 }).then((spoken) =>
      spoken ? 'browser' : 'silent'
    );
  }
  return speakNarration(assistantId, line, { asAnonymousIdentity });
}
