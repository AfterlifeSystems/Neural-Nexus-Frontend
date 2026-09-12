// Optional gender and standard-voice choice on Create Avatar.
//
// Neither field is required. When both are left blank, voice mode still needs
// something to speak until a clone is uploaded: the first catalogue voice
// for the chosen gender, or the gender inferred from the name, or female
// when the name does not decide.

import { inferAvatarGenderFromName } from './avatarGenderFromName.js';

export const CREATE_AVATAR_GENDER_OPTIONS = [
  { value: '', label: 'Unspecified' },
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
];

/**
 * Gender that picks the standard-voice catalogue.
 *
 * @param {Object} [options]
 * @param {string} [options.selectedGender] '' | 'female' | 'male'
 * @param {string} [options.avatarName]
 * @returns {'female'|'male'}
 */
export function effectiveCreateAvatarGender({
  selectedGender = '',
  avatarName = '',
} = {}) {
  if (selectedGender === 'female' || selectedGender === 'male') {
    return selectedGender;
  }
  return inferAvatarGenderFromName(avatarName) ?? 'female';
}

/**
 * The stock voice to store after create, if any.
 *
 * A picked voice wins. Otherwise the first voice in the loaded catalogue
 * (already filtered to the effective gender).
 *
 * @param {Object} [options]
 * @param {string} [options.selectedVoiceId]
 * @param {Array<{voice_id: string}>} [options.voices]
 * @returns {string}
 */
export function standardVoiceIdToAssign({
  selectedVoiceId = '',
  voices = [],
} = {}) {
  const chosen = String(selectedVoiceId ?? '').trim();
  if (chosen && voices.some((voice) => voice.voice_id === chosen)) {
    return chosen;
  }
  return String(voices[0]?.voice_id ?? '').trim();
}

/**
 * Store the standard voice on a just-created avatar. Failures are the
 * caller's to report; create itself already succeeded.
 *
 * @param {Object} options
 * @param {string} options.assistantId
 * @param {string} [options.voiceId]
 * @param {Function} [options.setStandardVoice]
 * @returns {Promise<Object|null>}
 */
export async function assignCreatedAvatarStandardVoice({
  assistantId,
  voiceId,
  setStandardVoice = setAvatarStandardVoice,
}) {
  const id = String(voiceId ?? '').trim();
  if (!assistantId || !id) return null;
  const assign =
    setStandardVoice ??
    (await import('./avatarService')).setAvatarStandardVoice;
  return assign(assistantId, id);
}
