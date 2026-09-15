// src/services/worldBackgroundFocus.js
//
// Which avatar the page-background globe should sit on. Chat and a shared
// link name one avatar in the URL. Avatar Selection names the front gallery
// card through setGalleryFocusedAssistantId. The globe flies there only when
// that avatar has a pin; otherwise it keeps the idle whole-world spin.
//
// No JSX and no import.meta.env, so the Node test runner can import this file.

import { avatarIdOf, pinOf } from './avatarProximity.js';

const galleryFocusListeners = new Set();
let galleryFocusedAssistantId = null;

/**
 * Whether this path is the interactive world map, which mounts its own globe.
 *
 * @param {string} pathname
 * @returns {boolean}
 */
export function isWorldMapPath(pathname) {
  const path = String(pathname ?? '').split('?')[0];
  return path === '/map' || path.startsWith('/map/');
}

/**
 * How the page-background globe should ask for public pins.
 *
 * Login, landing, and signup have no signed-in user. Sending a leftover
 * session credential there 401s, the catch used to write an empty pin list,
 * and `user` stayed null so the effect never asked again as a visitor.
 *
 * @param {Object|null|undefined} user
 * @returns {{asAnonymousIdentity: boolean}}
 */
export function geoListingIdentityForViewer(user) {
  return { asAnonymousIdentity: !user };
}

/**
 * The avatar the URL has open, or null when the globe should drift.
 *
 * @param {string} pathname
 * @returns {string|null}
 */
export function avatarIdFromGlobeFocusPath(pathname) {
  const path = String(pathname ?? '').split('?')[0];
  const chat = path.match(/^\/chat\/([^/]+)/);
  if (chat?.[1]) return decodeURIComponent(chat[1]);
  const share = path.match(/^\/share\/([^/]+)/);
  if (share?.[1]) return decodeURIComponent(share[1]);
  return null;
}

/**
 * The assistant id on the front Avatar Selection card, or null for Create
 * Avatar and any other non-avatar slot.
 *
 * @param {{type?: string, avatar_data?: Object}|null|undefined} card
 * @returns {string|null}
 */
export function assistantIdFromSelectionCard(card) {
  if (!card || card.type !== 'avatar') return null;
  const assistantId = avatarIdOf(card.avatar_data);
  return assistantId ? String(assistantId) : null;
}

/**
 * @param {string|null|undefined} assistantId
 */
export function setGalleryFocusedAssistantId(assistantId) {
  const next = String(assistantId ?? '').trim() || null;
  if (galleryFocusedAssistantId === next) return;
  galleryFocusedAssistantId = next;
  for (const listener of galleryFocusListeners) listener(next);
}

/**
 * @returns {string|null}
 */
export function getGalleryFocusedAssistantId() {
  return galleryFocusedAssistantId;
}

/**
 * @param {(assistantId: string|null) => void} listener
 * @returns {() => void}
 */
export function subscribeGalleryFocusedAssistantId(listener) {
  galleryFocusListeners.add(listener);
  return () => {
    galleryFocusListeners.delete(listener);
  };
}

/**
 * URL chat/share wins; otherwise the gallery's front card.
 *
 * @param {string} pathname
 * @param {string|null|undefined} [galleryAssistantId]
 * @returns {string|null}
 */
export function avatarIdForGlobeFocus(
  pathname,
  galleryAssistantId = galleryFocusedAssistantId
) {
  return (
    avatarIdFromGlobeFocusPath(pathname) ||
    (galleryAssistantId ? String(galleryAssistantId) : null) ||
    null
  );
}

/**
 * The pin already sitting on a known avatar record, if that record is the
 * one the URL named.
 *
 * @param {string} assistantId
 * @param {Array<Object|null|undefined>} avatars
 * @returns {{avatar: Object, pin: Object}|null}
 */
export function focusedGlobeAvatarFromLists(assistantId, avatars) {
  if (!assistantId) return null;
  const wanted = String(assistantId);
  for (const avatar of avatars ?? []) {
    if (!avatar) continue;
    if (String(avatarIdOf(avatar) ?? '') !== wanted) continue;
    const pin = pinOf(avatar);
    if (pin) return { avatar, pin };
  }
  return null;
}

/**
 * One globe.gl HTML-marker group for a single avatar pin.
 *
 * @param {Object} avatar
 * @param {Object} pin
 * @returns {Object}
 */
export function singleAvatarGlobeGroup(avatar, pin) {
  return {
    latitude: Number(pin.latitude),
    longitude: Number(pin.longitude),
    count: 1,
    avatars: [avatar],
    labelAvatar: avatar,
  };
}
