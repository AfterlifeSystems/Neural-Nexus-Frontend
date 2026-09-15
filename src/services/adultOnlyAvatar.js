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
 *
 * Demo / share mode: set ADULT_ONLY_FEATURES_ENABLED to true to restore
 * age-verification unlock and the administrator search exception. While the
 * flag is false, adult-only avatars stay hidden from every list for every
 * viewer (including the administrator), so the product can be demoed to
 * everyone without exposing adult avatars. Restore the commented admin
 * toggle and age-verification UI call sites at the same time.
 */

// TEMPORARILY INERT for public demos. Flip to true to restore adult-only
// unlock paths (age verification + administrator exception).
export const ADULT_ONLY_FEATURES_ENABLED = false;

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
 * While ADULT_ONLY_FEATURES_ENABLED is false, adult-only avatars stay out of
 * search for every viewer (including the administrator).
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
  // Inert for demos: hide adult-only avatars from every search list.
  if (!ADULT_ONLY_FEATURES_ENABLED) return false;
  return Boolean(ageVerified) || Boolean(isAdmin);
}

/**
 * Whether this viewer may keep an adult-only avatar on their gallery carousel.
 *
 * The owner still needs a way to open settings. The administrator needs the
 * same path to mark and unmark avatars they did not create. Search does not
 * use this function.
 *
 * While ADULT_ONLY_FEATURES_ENABLED is false, only the owner keeps an
 * adult-only avatar on the gallery (administrator exception and age
 * verification stay inert so demos do not surface those avatars).
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
  // Inert for demos: no administrator exception and no age-verification
  // unlock on the gallery list. The owner still reaches their own avatar.
  if (!ADULT_ONLY_FEATURES_ENABLED) {
    return isOwnedByViewer(avatar, viewerUserId);
  }
  if (ageVerified || isAdmin) return true;
  return isOwnedByViewer(avatar, viewerUserId);
}
