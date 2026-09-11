// src/services/personalAvatar.js
//
// The avatar that depicts the signed-in person. Speech-to-text of that person
// always uses this avatar: its reference clip is their voice. Talking to a
// character still sends the turn to that character; only the transcription
// identity is the personal avatar.

import { isPersonalCreatorAvatar } from './avatarListOrder.js';

/**
 * @param {Array|null|undefined} avatars
 * @returns {Object|null}
 */
export function personalAvatarOf(avatars) {
  if (!Array.isArray(avatars)) return null;
  return avatars.find(isPersonalCreatorAvatar) ?? null;
}

/**
 * @param {Object|null|undefined} avatar
 * @returns {string|null}
 */
export function assistantIdOfAvatar(avatar) {
  return (
    avatar?.assistant_id ??
    avatar?.avatar_id ??
    avatar?.metadata?.assistant_id ??
    null
  );
}

/**
 * @param {Array|null|undefined} avatars
 * @returns {string|null}
 */
export function personalAssistantIdOf(avatars) {
  return assistantIdOfAvatar(personalAvatarOf(avatars));
}

/**
 * Find the avatar that depicts the signed-in user.
 *
 * Preferring the list already in memory keeps the common case free of a round
 * trip; the API is asked only when the list has not been loaded or carries no
 * flagged avatar (a public entry has its metadata stripped, so the flag can be
 * missing from a list that nonetheless contains the avatar).
 *
 * @param {Array} [userAvatars] Avatars already held in context.
 * @returns {Promise<string|null>} The personal avatar's assistant_id.
 */
export async function resolvePersonalAvatarId(userAvatars) {
  const fromList = personalAssistantIdOf(userAvatars);
  if (fromList) return fromList;
  try {
    const { getPersonalAvatar } = await import('./avatarService.jsx');
    const personalAvatarResponse = await getPersonalAvatar();
    return personalAvatarResponse?.personal_avatar?.assistant_id ?? null;
  } catch (personalAvatarError) {
    console.error(
      'Could not resolve the personal avatar:',
      personalAvatarError
    );
    return null;
  }
}

/**
 * Which avatar to send a recording to for speech-to-text of the signed-in
 * person. Guests and shared-link visits have no personal avatar, so the
 * avatar being spoken to is used instead.
 *
 * @param {Object} [options]
 * @param {Array} [options.userAvatars]
 * @param {string|null|undefined} [options.fallbackAssistantId]
 * @param {boolean} [options.isAnonymous]
 * @returns {string|null}
 */
export function transcribeAssistantIdOf({
  userAvatars,
  fallbackAssistantId,
  isAnonymous = false,
} = {}) {
  if (isAnonymous) return fallbackAssistantId ?? null;
  return personalAssistantIdOf(userAvatars) ?? fallbackAssistantId ?? null;
}
