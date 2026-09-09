// src/components/voice/referenceAudioHealth.js
//
// What to tell the owner about the avatar's reference audio.
//
// The reference clip is the short single-speaker recording the diarizer uses to
// pick this avatar's voice out of every later upload. Without a usable clip the
// diarizer cannot tell the avatar from the other people in a recording, so the
// avatar either learns nothing from an upload or learns someone else's words as
// its own. That makes a missing or unusable clip worth saying out loud rather
// than leaving as an absence the owner has to notice.
//
// The server decides whether a stored clip is usable and sends the reason it is
// not (`GET /avatar_voice` → `reference_audio_usable` / `reference_audio_problem`).
// This module only decides what the panel says, so the wording stays testable
// without rendering the panel.
//
// Pure, so the Node test runner can load it.

/** What an upload has to contain before the clip can identify the avatar. */
export const REFERENCE_AUDIO_REQUIREMENT =
  'Upload a single video or recording in which this avatar speaks more than anyone else. A channel or playlist link is not one recording, so the clip would be cut from an arbitrary video.';

/**
 * Whether a voice status came from a server that reports reference health.
 *
 * A server without the two fields reports `undefined`, which must not be read
 * as "unusable" — otherwise every avatar on an older server is accused.
 *
 * @param {Object|null} status The voice status.
 * @returns {boolean} Whether the health fields are present.
 */
export function reportsReferenceAudioHealth(status) {
  return Boolean(status) && typeof status.reference_audio_usable === 'boolean';
}

/**
 * The warning to show about the reference audio, or null when nothing is wrong.
 *
 * @param {Object|null} status The voice status from `GET /avatar_voice`.
 * @param {string} [avatarName] The avatar's name, for the copy.
 * @returns {{title: string, detail: string}|null} The warning, or null when the
 *   stored clip can anchor the diarizer.
 */
export function referenceAudioWarning(status, avatarName) {
  // No status yet (the first render, or a failed fetch) is not a problem to
  // report — the panel would otherwise accuse a healthy avatar while loading.
  // A server that does not report reference health says nothing either, rather
  // than having a missing field read as "unusable".
  if (!reportsReferenceAudioHealth(status)) return null;
  if (status.reference_audio_usable) return null;

  const who = avatarName ?? 'this avatar';
  const requirement = REFERENCE_AUDIO_REQUIREMENT.replace(
    'this avatar',
    who
  );

  // `reference_audio_usable` is false both for an avatar with no reference at
  // all and for one holding a clip the diarizer would reject. The server's
  // sentence separates the two; older servers send neither field, and there the
  // filename is the only signal available.
  const storedDocument = status.reference_audio_document;
  const problem = status.reference_audio_problem;
  if (!storedDocument) {
    return {
      title: 'No reference audio yet',
      detail: `${problem ? `${problem} ` : ''}${requirement}`,
    };
  }
  return {
    title: `The reference audio from ${storedDocument} cannot identify this voice`,
    detail: `${problem ? `${problem} ` : ''}${requirement} The next upload that yields a usable clip replaces the current one.`,
  };
}
