// src/services/avatarMapMark.js
//
// How one avatar is told apart from another on the globe and the street map:
// initials from the name, and a short label. Colour stays in the existing
// amber / white palette — owned pins are amber, everyone else's are neutral.

/**
 * One or two letters from an avatar's name.
 *
 * @param {string|null|undefined} name
 * @returns {string}
 */
export function initialsOf(name) {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) {
    const word = parts[0];
    return word.slice(0, Math.min(2, word.length)).toUpperCase();
  }
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

/**
 * The mark drawn on both maps for one avatar.
 *
 * @param {Object|null|undefined} avatar
 * @returns {{initials: string, label: string}}
 */
export function mapMarkOf(avatar) {
  const name = (avatar?.name ?? '').trim() || 'Avatar';
  return {
    initials: initialsOf(name),
    label: name,
  };
}

/**
 * Whether a pinned avatar matches a search string (name, initials, or place).
 *
 * @param {Object|null|undefined} avatar
 * @param {string} query
 * @param {Object|null} [pin]
 * @returns {boolean}
 */
export function avatarMatchesSearch(avatar, query, pin = null) {
  const needle = String(query ?? '').trim().toLowerCase();
  if (!needle) return true;
  const mark = mapMarkOf(avatar);
  const haystack = [mark.label, mark.initials, pin?.location_name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}
