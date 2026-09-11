// src/components/research/researchBootstrapNotices.js
//
// Pure helpers for telling the owner what the research could NOT find.
//
// Creating an avatar starts research, and that research goes looking for a
// picture and a recording when the avatar has neither. Often it finds them.
// When it does not — a private individual, a name with no public presence, a
// namesake it could not tell apart — the avatar is left without a portrait or a
// voice, and the owner deserves to be told THAT rather than shown the same
// generic "add a portrait" prompt an avatar nobody researched would show.
//
// Kept apart from the hook that fetches the outcome so both can be tested
// without a DOM, the way researchProgress.js is.

/**
 * The sentence to show where a portrait would be, when there is none.
 *
 * @param {Object|null} outcome A recorded acquisition outcome.
 * @returns {string} What to tell the owner, or '' to leave the usual prompt.
 */
export const portraitEmptyStateNotice = (outcome) => {
  if (!outcome?.portrait_attempted || outcome.portrait_acquired) return '';
  return outcome.portrait_reason
    ? `No photograph of this subject could be found: ${outcome.portrait_reason} Add one here.`
    : 'No photograph of this subject could be found. Add one here.';
};

/**
 * The sentence to show where the reference recording would be, when there is none.
 *
 * @param {Object|null} outcome A recorded acquisition outcome.
 * @returns {string} What to tell the owner, or '' to leave the usual prompt.
 */
export const voiceEmptyStateNotice = (outcome) => {
  if (!outcome?.voice_attempted || outcome.voice_acquired) return '';
  return outcome.voice_reason
    ? `No recording of this subject speaking could be found: ${outcome.voice_reason} Upload one here.`
    : 'No recording of this subject speaking could be found. Upload one here.';
};
