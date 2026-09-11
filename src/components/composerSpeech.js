// src/components/composerSpeech.js
//
// Playing a composer draft in the person's own voice without sending a turn,
// and — in voice mode's composer only — appending dictated words to it. The
// chat message area is text-to-speech only.

export const COMPOSER_DRAFT_SPEAK_KEY = 'composer-draft';

/**
 * Append a transcribed utterance to whatever is already in the box.
 *
 * @param {string} [existing]
 * @param {string} [words]
 * @returns {string}
 */
export function appendSpokenTranscript(existing, words) {
  const next = String(words ?? '').trim();
  if (!next) return String(existing ?? '');
  const previous = String(existing ?? '').trimEnd();
  return previous ? `${previous} ${next}` : next;
}
