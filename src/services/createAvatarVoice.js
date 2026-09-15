// Optional gender and standard-voice choice on Create Avatar.
//
// Neither field is required. When both are left blank, voice mode still needs
// something to speak until a clone is uploaded: the first catalogue voice
// for the chosen gender, or the gender inferred from the name, or female
// when the name does not decide.

import {
  givenNameOfAvatar,
  inferAvatarGenderFromName,
} from './avatarGenderFromName.js';

export const CREATE_AVATAR_GENDER_OPTIONS = [
  { value: '', label: 'Unspecified' },
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
];

/**
 * @param {Object} [options]
 * @param {string} [options.selectedGender] '' | 'female' | 'male'
 * @param {string} [options.avatarName]
 * @returns {{gender: 'female'|'male', source: 'selected'|'inferred'|'fallback', givenName: string}}
 */
export function createAvatarGenderChoice({
  selectedGender = '',
  avatarName = '',
} = {}) {
  if (selectedGender === 'female' || selectedGender === 'male') {
    return { gender: selectedGender, source: 'selected', givenName: '' };
  }
  const inferred = inferAvatarGenderFromName(avatarName);
  if (inferred) {
    return {
      gender: inferred,
      source: 'inferred',
      givenName: givenNameOfAvatar(avatarName),
    };
  }
  return { gender: 'female', source: 'fallback', givenName: '' };
}

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
  return createAvatarGenderChoice({ selectedGender, avatarName }).gender;
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
 * Whether the creator picked a catalogue voice, rather than leaving the
 * first stock voice of the effective gender to be assigned.
 *
 * @param {Object} [options]
 * @param {string} [options.selectedVoiceId]
 * @param {Array<{voice_id: string}>} [options.voices]
 * @returns {boolean}
 */
export function standardVoiceWasChosen({
  selectedVoiceId = '',
  voices = [],
} = {}) {
  const chosen = String(selectedVoiceId ?? '').trim();
  return Boolean(
    chosen &&
      (Array.isArray(voices) ? voices : []).some(
        (voice) => voice.voice_id === chosen
      )
  );
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
  setStandardVoice,
}) {
  const id = String(voiceId ?? '').trim();
  if (!assistantId || !id) return null;
  const assign =
    setStandardVoice ??
    (await import('./avatarService')).setAvatarStandardVoice;
  return assign(assistantId, id);
}

/**
 * After create, store a stock voice. A picked voice is stored as-is. With
 * none picked, the first catalogue voice of the effective gender is stored
 * (the catalogue is fetched when the dialog did not already load it).
 *
 * @param {Object} options
 * @param {string} options.assistantId
 * @param {string} [options.avatarName]
 * @param {string} [options.selectedGender]
 * @param {string} [options.selectedVoiceId]
 * @param {Array<{voice_id: string, name?: string}>} [options.voices]
 * @param {(gender: string) => Promise<Array>} [options.listVoices]
 * @param {Function} [options.setStandardVoice]
 * @returns {Promise<{
 *   voiceWasChosen: boolean,
 *   genderChoice: {gender: 'female'|'male', source: string, givenName: string},
 *   voiceId: string,
 *   assignedVoice: {voice_id: string, name?: string}|null,
 *   assigned: boolean,
 *   assignError: Error|null,
 *   shouldShowGenderToast: boolean,
 * }>}
 */
export async function assignStandardVoiceAfterCreate({
  assistantId,
  avatarName = '',
  selectedGender = '',
  selectedVoiceId = '',
  voices = [],
  listVoices,
  setStandardVoice,
} = {}) {
  const genderChoice = createAvatarGenderChoice({
    selectedGender,
    avatarName,
  });
  const voiceWasChosen = standardVoiceWasChosen({
    selectedVoiceId,
    voices,
  });
  let catalogue = Array.isArray(voices) ? voices : [];
  if (!voiceWasChosen && catalogue.length === 0 && listVoices) {
    try {
      catalogue = (await listVoices(genderChoice.gender)) ?? [];
    } catch {
      catalogue = [];
    }
  }
  const voiceId = standardVoiceIdToAssign({
    selectedVoiceId: voiceWasChosen ? selectedVoiceId : '',
    voices: catalogue,
  });
  const assignedVoice =
    catalogue.find((voice) => voice.voice_id === voiceId) ?? null;
  let assigned = false;
  let assignError = null;
  if (assistantId && voiceId) {
    try {
      await assignCreatedAvatarStandardVoice({
        assistantId,
        voiceId,
        setStandardVoice,
      });
      assigned = true;
    } catch (error) {
      assignError = error;
    }
  }
  return {
    voiceWasChosen,
    genderChoice,
    voiceId,
    assignedVoice,
    assigned,
    assignError,
    shouldShowGenderToast: !voiceWasChosen || Boolean(assignError),
  };
}
