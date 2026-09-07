/**
 * Search-menu rows for the avatar gallery.
 *
 * The box lists every avatar this account can open, not only the ones on the
 * carousel. A row that is not on the ring is how that avatar gets added back.
 */

import { avatarsWithPersonalFirst } from '../services/avatarListOrder.js';
import {
  carouselAvatarId,
  isAvatarOnCarousel,
} from '../services/avatarCarouselMembership.js';

const CREATE_SUGGESTION = {
  id: 'create-avatar',
  type: 'create',
  text: 'Create Avatar',
  image: null,
  onCarousel: true,
  canAddToCarousel: false,
  avatar: null,
};

function matchesQuery(text, query) {
  const needle = String(query ?? '').trim().toLowerCase();
  if (!needle) return true;
  return String(text ?? '')
    .toLowerCase()
    .includes(needle);
}

/**
 * Suggestions under the gallery search box.
 *
 * Create Avatar stays on the list when the query is empty, or when nothing
 * else matches — the same fallback the box had before hide/add existed.
 *
 * @param {Object} parameters
 * @param {Array|null|undefined} parameters.avatars The full listing.
 * @param {string} [parameters.query]
 * @param {string[]} [parameters.hiddenIds]
 * @param {Record<string, string|null|undefined>} [parameters.iconsById]
 * @returns {Array}
 */
export function buildAvatarSearchSuggestions({
  avatars,
  query = '',
  hiddenIds = [],
  iconsById = {},
} = {}) {
  const ordered = avatarsWithPersonalFirst(avatars);
  const carouselIds = ordered
    .filter((avatar) => isAvatarOnCarousel(avatar, hiddenIds))
    .map((avatar) => carouselAvatarId(avatar));
  const createIndex = carouselIds.length;

  const rows = ordered
    .map((avatar) => {
      const id = carouselAvatarId(avatar);
      const onCarousel = isAvatarOnCarousel(avatar, hiddenIds);
      return {
        id,
        type: 'avatar',
        text: avatar?.name ?? '',
        image: id ? (iconsById[id] ?? null) : null,
        onCarousel,
        canAddToCarousel: Boolean(id) && !onCarousel,
        avatar,
        originalIndex: onCarousel ? carouselIds.indexOf(id) : -1,
      };
    })
    .filter((row) => matchesQuery(row.text, query));

  const createRow = {
    ...CREATE_SUGGESTION,
    originalIndex: createIndex,
  };
  const showCreate = matchesQuery(createRow.text, query);

  if (String(query ?? '').trim() && rows.length === 0) {
    return [createRow];
  }

  return showCreate ? [...rows, createRow] : rows;
}
