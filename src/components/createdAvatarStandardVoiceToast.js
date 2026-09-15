// Copy for the post-create stock-voice notice. The creator did not pick a
// voice, so a gender was inferred (or taken from the gender field, or female
// when the name does not decide) and the first catalogue voice of that gender
// was stored. The toast names that gender and points at Avatar Settings.

import { avatarVoiceSettingsPath } from './voiceNotReadyToast.js';

export { avatarVoiceSettingsPath };

/**
 * @param {string} [assistantId]
 * @returns {string}
 */
export function createdAvatarStandardVoiceToastId(assistantId) {
  return `created-standard-voice:${assistantId || 'avatar'}`;
}

/**
 * Title and body for the post-create stock-voice notice.
 *
 * @param {Object} [options]
 * @param {string} [options.avatarName]
 * @param {'female'|'male'} [options.gender]
 * @param {'selected'|'inferred'|'fallback'} [options.source]
 * @param {string} [options.givenName]
 * @param {string} [options.voiceName]
 * @param {boolean} [options.assigned]
 * @returns {{title: string, body: string, action: string}}
 */
export function createdAvatarStandardVoiceToastCopy({
  avatarName = '',
  gender,
  source,
  givenName,
  voiceName,
  assigned = true,
} = {}) {
  const genderLabel = gender === 'male' ? 'male' : 'female';
  const title = 'The avatar was created';
  const namedVoice = String(voiceName ?? '').trim();
  const voicePhrase = namedVoice
    ? `a ${genderLabel} stock voice (${namedVoice})`
    : `a ${genderLabel} stock voice`;
  const capitalizedVoicePhrase =
    voicePhrase.charAt(0).toUpperCase() + voicePhrase.slice(1);
  const action = assigned
    ? 'Select a different voice in Avatar Settings.'
    : 'Select a voice in Avatar Settings.';

  if (!assigned) {
    return {
      title,
      body: `${capitalizedVoicePhrase} could not be saved.`,
      action,
    };
  }

  if (source === 'inferred') {
    const name = String(givenName || avatarName || '').trim();
    const named = name ? `“${name}” reads as ${genderLabel}, so ` : '';
    return {
      title,
      body: `${named}${voicePhrase} was assigned.`,
      action,
    };
  }

  if (source === 'fallback') {
    return {
      title,
      body: `${capitalizedVoicePhrase} was assigned. The name did not specify a gender.`,
      action,
    };
  }

  return {
    title,
    body: `${capitalizedVoicePhrase} was assigned.`,
    action,
  };
}
