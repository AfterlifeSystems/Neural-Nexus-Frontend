/**
 * Keyboard on the avatar carousel.
 *
 * Left and right still turn the ring. Up opens chat for the front avatar.
 * Down opens settings for that same avatar. Enter still selects the front
 * card, which is chat on an avatar and Create on the Create slot.
 *
 * Search owns up and down while its box is focused or its dropdown is open,
 * so those keys keep walking suggestions instead of leaving the gallery.
 */

/** Turn one card left. */
export const GALLERY_CAROUSEL_INTENT_PREVIOUS = 'previous';

/** Turn one card right. */
export const GALLERY_CAROUSEL_INTENT_NEXT = 'next';

/** Select the front card: chat, or open Create. */
export const GALLERY_CAROUSEL_INTENT_SELECT = 'select';

/** Open chat for the front avatar. */
export const GALLERY_CAROUSEL_INTENT_CHAT = 'chat';

/** Open settings for the front avatar. */
export const GALLERY_CAROUSEL_INTENT_SETTINGS = 'settings';

/**
 * Whether search should keep this key instead of the carousel.
 *
 * @param {Object} [context]
 * @param {boolean} [context.searchOwnsKeys]
 * @param {boolean} [context.menuOpen]
 * @param {boolean} [context.modalOpen]
 * @returns {boolean}
 */
export function galleryCarouselKeysAreBlocked(context = {}) {
  return Boolean(
    context.searchOwnsKeys || context.menuOpen || context.modalOpen
  );
}

/**
 * What a key on the avatar carousel should do.
 *
 * Modifier chords are left to the browser. Up and down only act on an avatar
 * card: the Create slot has no chat and no settings.
 *
 * @param {KeyboardEvent|{key?: string, altKey?: boolean, ctrlKey?: boolean, metaKey?: boolean}|null|undefined} keyEvent
 * @param {Object} [context]
 * @param {boolean} [context.searchOwnsKeys] Search box focused or dropdown open.
 * @param {boolean} [context.menuOpen] User Settings menu is open.
 * @param {boolean} [context.modalOpen] Create Avatar dialog is open.
 * @param {string} [context.frontCardType] `avatar` or `create`.
 * @returns {string|null}
 */
export function galleryCarouselKeyIntent(keyEvent, context = {}) {
  if (!keyEvent) return null;
  if (keyEvent.altKey || keyEvent.ctrlKey || keyEvent.metaKey) return null;
  if (galleryCarouselKeysAreBlocked(context)) return null;

  const key = keyEvent.key;
  if (key === 'ArrowLeft') return GALLERY_CAROUSEL_INTENT_PREVIOUS;
  if (key === 'ArrowRight') return GALLERY_CAROUSEL_INTENT_NEXT;
  if (key === 'Enter') return GALLERY_CAROUSEL_INTENT_SELECT;
  if (key === 'ArrowUp') {
    return context.frontCardType === 'avatar'
      ? GALLERY_CAROUSEL_INTENT_CHAT
      : null;
  }
  if (key === 'ArrowDown') {
    return context.frontCardType === 'avatar'
      ? GALLERY_CAROUSEL_INTENT_SETTINGS
      : null;
  }
  return null;
}
