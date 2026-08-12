export const isValidImageUrl = (url) => {
  if (!url) return false;
  if (url.startsWith('data:image/')) {
    return url.includes('base64,');
  }
  return /^(https?:\/\/|\/)/.test(url);
};

/**
 * Decide whether the signed-in user created this avatar.
 *
 * `metadata.user_id` is the creator, and it is the same field the API enforces
 * on for editing, uploading and deleting. Public listings strip `metadata`
 * entirely and the user listing strips it from any public entry, so an avatar
 * with no metadata is one the caller does not own — absence is the answer, not
 * missing information.
 *
 * Ownership decides whether settings are offered at all, so it fails closed:
 * without a signed-in user or an avatar, nobody owns anything.
 *
 * @param {Object} avatar An avatar/assistant record.
 * @param {Object} user The signed-in user.
 * @returns {boolean} Whether the user may administer this avatar.
 */
export const isAvatarOwnedByUser = (avatar, user) => {
  if (!avatar || !user?.id) return false;
  const creatorId = avatar.metadata?.user_id;
  return Boolean(creatorId) && creatorId === user.id;
};

/**
 * Drop every browser-local trace of one avatar.
 *
 * The selection screen caches an avatar's icon and gallery position under
 * per-avatar keys, and remembers the last avatar used. Those entries outlive the
 * avatar itself, so a deleted avatar can reappear as a tile or be restored as
 * the last selection unless they are removed at the moment of deletion.
 *
 * @param {string} avatarId The assistant_id of the avatar being forgotten.
 */
export const forgetCachedAvatar = (avatarId) => {
  if (!avatarId) return;
  try {
    localStorage.removeItem(`avatar_icon_${avatarId}`);
    localStorage.removeItem(`avatar_position_${avatarId}`);
    for (const sharedKey of [
      'last_used_avatar_id',
      'last_used_avatar_index',
      'last_avatar_icon',
      'last_avatar_position',
      'current_card_index',
    ]) {
      // These name "whichever avatar was last used" rather than a specific one,
      // so they cannot be checked against this id — and pointing at a deleted
      // avatar is worse than pointing at nothing.
      localStorage.removeItem(sharedKey);
    }
  } catch (cacheError) {
    // Storage can be unavailable (private mode, quota). Losing the cleanup is
    // survivable; failing the deletion over it is not.
    console.error('Failed to clear cached avatar state:', cacheError);
  }
};
