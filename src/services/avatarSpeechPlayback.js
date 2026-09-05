// src/services/avatarSpeechPlayback.js
//
// Two different questions, kept apart on purpose:
//
//   Speech-to-text (dictation / live listening) — anyone who can send a turn
//   may talk into the microphone. Character avatars such as a public figure
//   still take spoken input.
//
//   Cloned-voice playback (speak aloud / live vocal replies) — narrower.
//   Default: signed-in account on a personal avatar only.
//   Exceptions: avatars created by the administrator (that account may hear
//   them), and a personal avatar published on /share/… (visitors included).
//
// Entering voice mode itself is always allowed. A public listing with
// metadata stripped is not enough on its own inside signed-in /chat — that
// would also unlock admin-shared character avatars for every other account.

import { isAdminAccount } from '../config/adminAccount.js';

const SHARED_AVATAR_ROUTE_PREFIX = '/share';

/**
 * @param {string} [pathname]
 * @returns {boolean}
 */
function isSharedAvatarChatPath(pathname) {
  const path =
    pathname ??
    (typeof window !== 'undefined' ? window.location?.pathname ?? '' : '');
  return (
    new RegExp(`^${SHARED_AVATAR_ROUTE_PREFIX}/[^/]+/?$`).test(path) ||
    new RegExp(`^${SHARED_AVATAR_ROUTE_PREFIX}/[^/]+/c/[^/]+/?$`).test(path)
  );
}

/**
 * @param {Object|null|undefined} avatar
 * @param {Object|null|undefined} user
 * @returns {boolean}
 */
function isAvatarOwnedByUser(avatar, user) {
  if (!avatar || !user?.id) return false;
  const creatorId = avatar.metadata?.user_id;
  return Boolean(creatorId) && creatorId === user.id;
}

/**
 * Personal flag must be the boolean true (API / backend compare with `is True`).
 *
 * @param {Object|null|undefined} avatar
 * @returns {boolean}
 */
function isPersonalAvatar(avatar) {
  return avatar?.metadata?.is_personal_avatar_of_creator === true;
}

/**
 * Decide whether this reader may dictate to the avatar (speech-to-text).
 *
 * Distinct from {@link canUseAvatarSpeechPlayback}. Talking in is allowed
 * whenever a turn can be sent; hearing a cloned voice back is not.
 *
 * @param {Object|null|undefined} avatar The open avatar.
 * @param {Object|null|undefined} user The signed-in user, if any.
 * @param {Object} [options]
 * @param {string} [options.pathname] Path to judge for shared-link access;
 *   defaults to the current location.
 * @returns {boolean}
 */
export function canUseAvatarSpeechInput(avatar, user, { pathname } = {}) {
  if (!avatar) return false;
  if (user?.id) return true;
  return isSharedAvatarChatPath(pathname);
}

/**
 * Decide whether this avatar may play cloned-voice audio for the current
 * reader. Voice mode and dictation may still run when this is false.
 *
 * @param {Object|null|undefined} avatar The open avatar.
 * @param {Object|null|undefined} user The signed-in user, if any.
 * @param {Object} [options]
 * @param {string} [options.pathname] Path to judge for shared-link access;
 *   defaults to the current location.
 * @returns {boolean}
 */
export function canUseAvatarSpeechPlayback(avatar, user, { pathname } = {}) {
  if (!avatar) return false;

  const isPersonal = isPersonalAvatar(avatar);
  const owned = isAvatarOwnedByUser(avatar, user);
  const userIsAdmin = isAdminAccount(user);
  const onSharedLink = isSharedAvatarChatPath(pathname);

  // Administrator may use spoken audio on any avatar they created.
  if (userIsAdmin && owned) return true;

  // Signed-in reader on a personal avatar (private or their own public copy).
  if (user?.id && isPersonal) return true;

  // Public share link: ordinary creators may publish only a personal avatar.
  // When metadata is still present, require the personal flag so an
  // administrator-shared character does not unlock spoken audio for others.
  if (onSharedLink) {
    if (avatar.metadata) return isPersonal;
    return true;
  }

  return false;
}
