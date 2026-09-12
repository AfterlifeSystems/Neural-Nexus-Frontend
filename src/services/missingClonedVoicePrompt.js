// Whether to ask the reader to add a cloned voice.
//
// Administrator-created characters are not likenesses that need a recording.
// That account sees Voice settings on those avatars so a stock voice can be
// chosen; the missing-clone toast must not appear there. The administrator's
// own personal avatar still needs the notice, as does every other account.

import { isAdminAccount } from '../config/adminAccount.js';

/**
 * @param {Object|null|undefined} avatar
 * @param {Object|null|undefined} user
 * @returns {boolean}
 */
function isAvatarCreatedByUser(avatar, user) {
  if (!avatar || !user?.id) return false;
  const creatorId = avatar.metadata?.user_id;
  return Boolean(creatorId) && creatorId === user.id;
}

/**
 * @param {Object|null|undefined} avatar
 * @returns {boolean}
 */
function isPersonalAvatarOfCreator(avatar) {
  return avatar?.metadata?.is_personal_avatar_of_creator === true;
}

/**
 * Whether the missing-clone toast should be offered for this avatar and reader.
 *
 * @param {Object} [options]
 * @param {Object|null|undefined} [options.avatar] The open avatar.
 * @param {Object|null|undefined} [options.user] The signed-in user.
 * @returns {boolean}
 */
export function shouldPromptForMissingClonedVoice({ avatar, user } = {}) {
  if (
    isAdminAccount(user) &&
    isAvatarCreatedByUser(avatar, user) &&
    !isPersonalAvatarOfCreator(avatar)
  ) {
    return false;
  }
  return true;
}
