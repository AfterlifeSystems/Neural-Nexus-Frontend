// Portrait cache for the gallery's first paint.
//
// Each portrait is a base64 data URI and can run to hundreds of kilobytes.
// They live in localStorage so a returning visitor sees faces before the API
// answers. The origin quota is a few megabytes, so a production account that
// has collected many portraits — plus leftovers from deleted avatars — will
// fill it. The cache is an optimisation; the API remains the source of truth.

export const AVATAR_ICON_KEY_PREFIX = 'avatar_icon_';

// Leftover from an earlier writer that stored a second full copy of the
// selected portrait on every gallery click. Nothing reads this key.
export const LAST_AVATAR_ICON_STORAGE_KEY = 'last_avatar_icon';

/**
 * @param {Storage|null|undefined} [storage]
 * @returns {Storage|null}
 */
function resolveStorage(storage) {
  if (storage === null) return null;
  if (storage !== undefined) return storage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * @param {unknown} error
 * @returns {boolean}
 */
export function isQuotaExceededError(error) {
  if (!error || typeof error !== 'object') return false;
  const name = error.name;
  const code = error.code;
  return (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    code === 22 ||
    code === 1014
  );
}

/**
 * @param {Storage} storage
 * @param {string} [exceptAvatarId]
 * @returns {string[]}
 */
function listCachedAvatarIconKeys(storage, exceptAvatarId) {
  const keys = [];
  const exceptKey = exceptAvatarId
    ? `${AVATAR_ICON_KEY_PREFIX}${exceptAvatarId}`
    : null;
  for (let keyIndex = 0; keyIndex < storage.length; keyIndex++) {
    const key = storage.key(keyIndex);
    if (!key?.startsWith(AVATAR_ICON_KEY_PREFIX)) continue;
    if (exceptKey && key === exceptKey) continue;
    keys.push(key);
  }
  return keys;
}

/**
 * Drop the leftover duplicate, then the largest other portrait.
 *
 * @param {Storage} storage
 * @param {string} exceptAvatarId
 * @returns {boolean} Whether anything was removed.
 */
function evictOneCachedAvatarIcon(storage, exceptAvatarId) {
  try {
    if (storage.getItem(LAST_AVATAR_ICON_STORAGE_KEY)) {
      storage.removeItem(LAST_AVATAR_ICON_STORAGE_KEY);
      return true;
    }
  } catch {
    // Reading the leftover can throw in private mode; keep going.
  }

  const otherKeys = listCachedAvatarIconKeys(storage, exceptAvatarId);
  if (otherKeys.length === 0) return false;

  let largestKey = otherKeys[0];
  let largestLength = 0;
  for (const key of otherKeys) {
    const valueLength = storage.getItem(key)?.length ?? 0;
    if (valueLength >= largestLength) {
      largestKey = key;
      largestLength = valueLength;
    }
  }
  storage.removeItem(largestKey);
  return true;
}

/**
 * Every portrait this browser has already seen, keyed by assistant_id.
 *
 * Read synchronously at mount so the gallery can paint immediately instead of
 * waiting on a request per avatar. What comes back may be stale — the caller is
 * expected to revalidate against the API and correct any entry that changed.
 *
 * Also drops the leftover `last_avatar_icon` duplicate so a production profile
 * that has been writing that second copy gets the space back on the next visit.
 *
 * @param {Storage|null|undefined} [storage]
 * @returns {Object} A map of assistant_id to data URI / URL.
 */
export const readCachedAvatarIcons = (storage) => {
  const resolvedStorage = resolveStorage(storage);
  const cachedIcons = {};
  if (!resolvedStorage) return cachedIcons;
  try {
    try {
      resolvedStorage.removeItem(LAST_AVATAR_ICON_STORAGE_KEY);
    } catch {
      // Losing the leftover costs nothing; reading the real keys still matters.
    }
    for (let keyIndex = 0; keyIndex < resolvedStorage.length; keyIndex++) {
      const key = resolvedStorage.key(keyIndex);
      if (!key?.startsWith(AVATAR_ICON_KEY_PREFIX)) continue;
      const iconSource = resolvedStorage.getItem(key);
      if (iconSource) {
        cachedIcons[key.slice(AVATAR_ICON_KEY_PREFIX.length)] = iconSource;
      }
    }
  } catch (cacheError) {
    // Private mode and disabled storage both throw here. A cold gallery is the
    // cost; it still fills in from the API.
    console.error('Failed to read cached avatar portraits:', cacheError);
  }
  return cachedIcons;
};

/**
 * Remember one avatar's portrait for the next visit.
 *
 * When the origin quota is full, other cached portraits (largest first) and
 * the leftover last-icon duplicate are dropped until this write fits. If this
 * one image alone cannot fit, the write is skipped; the gallery still paints
 * from the API.
 *
 * @param {string} avatarId The assistant_id the portrait belongs to.
 * @param {string} iconSource A data URI or image URL.
 * @param {Storage|null|undefined} [storage]
 */
export const writeCachedAvatarIcon = (avatarId, iconSource, storage) => {
  if (!avatarId || !iconSource) return;
  const resolvedStorage = resolveStorage(storage);
  if (!resolvedStorage) return;
  const storageKey = `${AVATAR_ICON_KEY_PREFIX}${avatarId}`;
  try {
    resolvedStorage.setItem(storageKey, iconSource);
    return;
  } catch (cacheError) {
    if (!isQuotaExceededError(cacheError)) {
      console.error('Failed to cache an avatar portrait:', cacheError);
      return;
    }
  }

  while (evictOneCachedAvatarIcon(resolvedStorage, avatarId)) {
    try {
      resolvedStorage.setItem(storageKey, iconSource);
      return;
    } catch (retryError) {
      if (!isQuotaExceededError(retryError)) {
        console.error('Failed to cache an avatar portrait:', retryError);
        return;
      }
    }
  }
};

/**
 * Forget one avatar's portrait, leaving the rest of its cached state alone.
 *
 * Used when the API answers that an avatar has no stored portrait: the entry is
 * not stale, it is wrong, and leaving it would show a picture the avatar no
 * longer has.
 *
 * @param {string} avatarId The assistant_id whose portrait is gone.
 * @param {Storage|null|undefined} [storage]
 */
export const forgetCachedAvatarIcon = (avatarId, storage) => {
  if (!avatarId) return;
  const resolvedStorage = resolveStorage(storage);
  if (!resolvedStorage) return;
  try {
    resolvedStorage.removeItem(`${AVATAR_ICON_KEY_PREFIX}${avatarId}`);
  } catch (cacheError) {
    console.error('Failed to drop a cached avatar portrait:', cacheError);
  }
};

/**
 * Drop portraits for avatars that are no longer in the live list.
 *
 * Production profiles keep `avatar_icon_*` keys after an avatar is deleted
 * without going through {@link forgetCachedAvatar}. Those leftovers are what
 * fill the quota on neuralnexus.site. An empty keep-list is ignored so a
 * loading gallery cannot wipe a still-valid cache.
 *
 * @param {Iterable<string|null|undefined>} avatarIds Avatars to keep.
 * @param {Storage|null|undefined} [storage]
 */
export const forgetCachedAvatarIconsExcept = (avatarIds, storage) => {
  const resolvedStorage = resolveStorage(storage);
  if (!resolvedStorage) return;
  const keep = new Set(
    [...(avatarIds ?? [])].filter(
      (avatarId) => typeof avatarId === 'string' && avatarId.length > 0
    )
  );
  if (keep.size === 0) return;
  try {
    const keysToRemove = [];
    for (let keyIndex = 0; keyIndex < resolvedStorage.length; keyIndex++) {
      const key = resolvedStorage.key(keyIndex);
      if (!key?.startsWith(AVATAR_ICON_KEY_PREFIX)) continue;
      const avatarId = key.slice(AVATAR_ICON_KEY_PREFIX.length);
      if (!keep.has(avatarId)) keysToRemove.push(key);
    }
    for (const key of keysToRemove) {
      resolvedStorage.removeItem(key);
    }
  } catch (cacheError) {
    console.error('Failed to drop leftover avatar portraits:', cacheError);
  }
};
