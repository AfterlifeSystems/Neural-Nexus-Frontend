/**
 * Adult-only avatars stay out of search until the viewer has confirmed their age.
 *
 * The administrator marks an avatar adult-only. Search, public listings, and
 * the world map then hide that avatar until the signed-in account verifies
 * age. The administrator account (e.woods.business@icloud.com) is the one
 * exception: that account has to find every avatar, including adult-only
 * ones, so it can mark and unmark them. Being the creator of an avatar does
 * not put the name in search; the owner still reaches it from their carousel
 * or a share link. A public record may carry the flag at the top level
 * because public listings strip metadata.
 */

export function isAdultOnlyAvatar(avatar) {
  if (!avatar) return false;
  const value = avatar.adult_only ?? avatar.metadata?.adult_only;
  return value === true || String(value).toLowerCase() === 'true';
}

function isOwnedByViewer(avatar, viewerUserId) {
  const creatorId = avatar?.metadata?.user_id;
  return Boolean(viewerUserId && creatorId && viewerUserId === creatorId);
}

/**
 * Whether this viewer may see an adult-only avatar in search.
 *
 * Age verification unlocks search for ordinary accounts. The administrator
 * always sees adult-only names. The creator does not.
 *
 * @param {Object|null|undefined} avatar
 * @param {Object} [viewer]
 * @param {boolean} [viewer.ageVerified]
 * @param {boolean} [viewer.isAdmin]
 * @returns {boolean}
 */
export function maySeeAdultOnlyAvatarInSearch(
  avatar,
  { ageVerified = false, isAdmin = false } = {}
) {
  if (!isAdultOnlyAvatar(avatar)) return true;
  return Boolean(ageVerified) || Boolean(isAdmin);
}

/**
 * Whether this viewer may keep an adult-only avatar on their gallery carousel.
 *
 * The owner still needs a way to open settings. The administrator needs the
 * same path to mark and unmark avatars they did not create. Search does not
 * use this function.
 *
 * @param {Object|null|undefined} avatar
 * @param {Object} [viewer]
 * @param {boolean} [viewer.ageVerified]
 * @param {boolean} [viewer.isAdmin]
 * @param {string} [viewer.viewerUserId]
 * @returns {boolean}
 */
export function mayKeepAdultOnlyAvatarOnGallery(
  avatar,
  { ageVerified = false, isAdmin = false, viewerUserId } = {}
) {
  if (!isAdultOnlyAvatar(avatar)) return true;
  if (ageVerified || isAdmin) return true;
  return isOwnedByViewer(avatar, viewerUserId);
}
