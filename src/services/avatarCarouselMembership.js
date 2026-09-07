/**
 * Which avatars sit on the gallery carousel.
 *
 * The listing is every avatar this account can open. The carousel is the
 * shorter ring the person actually flips through. Hiding takes a card off
 * that ring without deleting the avatar; search can put it back. The
 * personal avatar stays on the ring.
 */

import { isPersonalCreatorAvatar } from './avatarListOrder.js';

const STORAGE_KEY = 'neural_nexus_hidden_carousel_avatars';

/**
 * @param {unknown} avatar An avatar record, or an id string.
 * @returns {string}
 */
export function carouselAvatarId(avatar) {
  if (typeof avatar === 'string') return avatar.trim();
  return String(
    avatar?.assistant_id ?? avatar?.avatar_id ?? avatar?.metadata?.assistant_id ?? ''
  ).trim();
}

function emptyHiddenByUser() {
  return {};
}

/**
 * @param {Storage|null|undefined} [storage]
 * @returns {Record<string, string[]>}
 */
function readHiddenByUser(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(STORAGE_KEY) || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return emptyHiddenByUser();
    }
    return parsed;
  } catch {
    return emptyHiddenByUser();
  }
}

function uniqueIds(ids) {
  const seen = new Set();
  const unique = [];
  for (const id of ids ?? []) {
    const trimmed = typeof id === 'string' ? id.trim() : '';
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    unique.push(trimmed);
  }
  return unique;
}

/**
 * Avatar ids this account has taken off the carousel.
 *
 * @param {string|null|undefined} userId
 * @param {Storage|null|undefined} [storage]
 * @returns {string[]}
 */
export function readHiddenCarouselAvatarIds(
  userId,
  storage = globalThis.localStorage
) {
  const key = String(userId ?? '').trim();
  if (!key) return [];
  return uniqueIds(readHiddenByUser(storage)[key]);
}

/**
 * @param {string|null|undefined} userId
 * @param {string[]} hiddenIds
 * @param {Storage|null|undefined} [storage]
 */
export function writeHiddenCarouselAvatarIds(
  userId,
  hiddenIds,
  storage = globalThis.localStorage
) {
  const key = String(userId ?? '').trim();
  if (!key) return;
  try {
    const next = {
      ...readHiddenByUser(storage),
      [key]: uniqueIds(hiddenIds),
    };
    storage?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode and a full quota both refuse writes; the hide then
    // lasts only as long as this screen stays mounted.
  }
}

/**
 * The personal avatar is the home seat. It cannot leave the ring.
 *
 * @param {Object|string|null|undefined} avatar
 * @returns {boolean}
 */
export function canHideAvatarOnCarousel(avatar) {
  const id = carouselAvatarId(avatar);
  if (!id) return false;
  return !isPersonalCreatorAvatar(avatar);
}

/**
 * The control under the front card, left of settings.
 *
 * The personal avatar opens its inbox. Other cards can be hidden.
 *
 * @param {Object|string|null|undefined} avatar
 * @returns {'inbox'|'hide'|null}
 */
export function carouselCompanionAction(avatar) {
  const id = carouselAvatarId(avatar);
  if (!id) return null;
  if (isPersonalCreatorAvatar(avatar)) return 'inbox';
  return 'hide';
}

/**
 * @param {string|Object} assistantId An id, or the avatar record.
 * @param {string[]} hiddenIds
 * @returns {string[]}
 */
export function hideAvatarOnCarousel(assistantId, hiddenIds) {
  if (!canHideAvatarOnCarousel(assistantId)) return uniqueIds(hiddenIds);
  const id = carouselAvatarId(assistantId);
  return uniqueIds([...(hiddenIds ?? []), id]);
}

/**
 * @param {string} assistantId
 * @param {string[]} hiddenIds
 * @returns {string[]}
 */
export function showAvatarOnCarousel(assistantId, hiddenIds) {
  const id = carouselAvatarId(assistantId);
  if (!id) return uniqueIds(hiddenIds);
  return uniqueIds(hiddenIds).filter((hiddenId) => hiddenId !== id);
}

/**
 * @param {Object} avatar
 * @param {string[]} hiddenIds
 * @returns {boolean}
 */
export function isAvatarOnCarousel(avatar, hiddenIds) {
  const id = carouselAvatarId(avatar);
  if (!id) return false;
  if (isPersonalCreatorAvatar(avatar)) return true;
  return !uniqueIds(hiddenIds).includes(id);
}

/**
 * The cards the gallery should draw, personal-first order preserved.
 *
 * @param {Array|null|undefined} avatars
 * @param {string[]} hiddenIds
 * @returns {Array}
 */
export function avatarsOnCarousel(avatars, hiddenIds) {
  if (!Array.isArray(avatars)) return [];
  const hidden = new Set(uniqueIds(hiddenIds));
  return avatars.filter((avatar) => {
    const id = carouselAvatarId(avatar);
    if (!id) return false;
    if (isPersonalCreatorAvatar(avatar)) return true;
    return !hidden.has(id);
  });
}

/**
 * Keep the strip on a real card after one is hidden.
 *
 * @param {number} currentIndex
 * @param {number} cardCount The gallery length after the hide, including Create.
 * @returns {number}
 */
export function clampCarouselIndex(currentIndex, cardCount) {
  if (!Number.isFinite(cardCount) || cardCount <= 0) return 0;
  if (!Number.isFinite(currentIndex) || currentIndex < 0) return 0;
  return Math.min(currentIndex, cardCount - 1);
}
