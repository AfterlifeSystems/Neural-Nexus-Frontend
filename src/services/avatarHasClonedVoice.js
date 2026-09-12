// A standard (stock) voice can speak without a clone. Callers that ask
// "can this avatar be heard" must not use this. Callers that ask "has a
// cloned voice been added to this model" must.

/**
 * Whether the avatar has a usable cloned voice (instant or professional).
 *
 * `has_voice` from readiness is true whenever any voice can speak, including
 * a chosen standard voice. That flag alone must not count as a clone.
 *
 * @param {Object|null|undefined} voice Status from GET /avatar_voice, or the
 *   `voice` record on a transcribe reply.
 * @returns {boolean}
 */
export function avatarHasClonedVoice(voice) {
  if (!voice || typeof voice !== 'object') return false;
  if (voice.instant_voice_blocked === true || voice.blocked === true) {
    return false;
  }
  const activeVoice = voice.active_voice;
  if (activeVoice === 'instant' || activeVoice === 'professional') {
    return true;
  }
  if (activeVoice === 'standard' || activeVoice === 'none') {
    return false;
  }
  return Boolean(voice.instant_voice_id || voice.professional_voice_id);
}
