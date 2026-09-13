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
 * The sentence an avatar record carries about itself, wherever it was put:
 * the record's own `description`, or the one kept in its metadata, or a bio.
 *
 * @param {Object|null|undefined} avatar
 * @returns {string}
 */
export function avatarDescriptionOf(avatar) {
  const text =
    avatar?.description ||
    avatar?.metadata?.description ||
    avatar?.metadata?.bio ||
    avatar?.bio ||
    '';
  return typeof text === 'string' ? text.trim() : '';
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

/**
 * How closely a pinned avatar matches a search string. Lower is a better
 * match: the avatar named "Bank of America" outranks Evan, who merely stands
 * at a place with that name.
 *
 * @param {Object|null|undefined} avatar
 * @param {string} query
 * @param {Object|null} [pin]
 * @returns {number}
 */
export function avatarSearchRank(avatar, query, pin = null) {
  const needle = String(query ?? '').trim().toLowerCase();
  if (!needle) return 0;
  const mark = mapMarkOf(avatar);
  const name = String(mark.label ?? '').toLowerCase();
  const initials = String(mark.initials ?? '').toLowerCase();
  const place = String(pin?.location_name ?? '').toLowerCase();
  if (name === needle) return 0;
  if (name.startsWith(needle)) return 1;
  if (name.includes(needle)) return 2;
  if (initials === needle || initials.includes(needle)) return 3;
  if (place.includes(needle)) return 4;
  return 5;
}
