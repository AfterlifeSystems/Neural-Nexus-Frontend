/**
 * Order of the signed-in person's avatars.
 *
 * The list endpoint does not promise a position for the personal avatar.
 * After login the gallery and every other list should show that avatar first,
 * then the rest A–Z by name.
 */

export function isPersonalCreatorAvatar(avatar) {
  return avatar?.metadata?.is_personal_avatar_of_creator === true;
}

function avatarNameForSort(avatar) {
  return String(avatar?.name ?? '').trim();
}

function compareAvatarsAlphabetically(left, right) {
  const byName = avatarNameForSort(left).localeCompare(
    avatarNameForSort(right),
    undefined,
    { sensitivity: 'base' }
  );
  if (byName !== 0) return byName;
  const leftId = String(left?.assistant_id ?? left?.avatar_id ?? '');
  const rightId = String(right?.assistant_id ?? right?.avatar_id ?? '');
  return leftId.localeCompare(rightId);
}

/**
 * Put the account's personal avatar at the front, then the others A–Z by name.
 * A list with no personal avatar is sorted the same way.
 *
 * @param {Array|null|undefined} avatars
 * @returns {Array}
 */
export function avatarsWithPersonalFirst(avatars) {
  if (!Array.isArray(avatars)) return [];
  const personal = avatars.find(isPersonalCreatorAvatar);
  const others = avatars
    .filter((avatar) => !isPersonalCreatorAvatar(avatar))
    .slice()
    .sort(compareAvatarsAlphabetically);
  return personal ? [personal, ...others] : others;
}

/**
 * Which card the gallery should open on.
 *
 * Always the personal avatar when one is in the list. Last-used and stored
 * strip positions must not steal the opening seat.
 *
 * @param {Array|null|undefined} avatars The cards in gallery order.
 * @returns {number} A valid index, or 0 when the list is empty.
 */
export function startingCarouselIndex(avatars) {
  if (!Array.isArray(avatars) || avatars.length === 0) return 0;
  const personalIndex = avatars.findIndex(isPersonalCreatorAvatar);
  return personalIndex >= 0 ? personalIndex : 0;
}
