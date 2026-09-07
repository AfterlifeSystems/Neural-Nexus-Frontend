/** Map a gallery scroll position to the item currently at center. */
export function galleryIndexFromScroll(scroll, itemWidth, length) {
  if (!itemWidth || !length) return 0;
  const itemIndex = Math.round(scroll / itemWidth);
  return ((itemIndex % length) + length) % length;
}

/**
 * Whether the Create Avatar plane is the card sitting at centre.
 *
 * Hide/settings belong under an avatar, not under Create. The React
 * strip index lags a drag, so this reads the plane itself.
 *
 * @param {number} planeX Plane x in gallery units (0 is centre).
 * @param {number} cardWidth One card's width in the same units.
 * @returns {boolean}
 */
export function isCreateCardAtCenter(planeX, cardWidth) {
  if (!Number.isFinite(planeX) || !Number.isFinite(cardWidth) || cardWidth <= 0) {
    return false;
  }
  return Math.abs(planeX) < cardWidth / 2;
}

/**
 * Scroll position that shows `index` with the shortest travel from `scroll`.
 * Infinite wrap uses every equivalent slot: …, index − n, index, index + n, …
 */
export function nearestGalleryScroll(scroll, index, itemWidth, length) {
  if (!itemWidth || !length) return 0;
  const clamped = ((index % length) + length) % length;
  const base = itemWidth * clamped;
  const cycle = itemWidth * length;
  const k = Math.round((scroll - base) / cycle);
  return base + k * cycle;
}

/**
 * Keep the same card under the playhead after a slot width change.
 *
 * The gallery measures width from the container. A later layout pass
 * (sidebar, flex settle, window resize) changes that width but used to
 * leave `scroll` in the old units, so the playhead sat in the gap
 * between two avatars.
 *
 * @param {number} scroll
 * @param {number} fromWidth
 * @param {number} toWidth
 * @returns {number}
 */
export function scaleGalleryScroll(scroll, fromWidth, toWidth) {
  if (!Number.isFinite(scroll) || !fromWidth || !toWidth) return 0;
  return scroll * (toWidth / fromWidth);
}

/**
 * Whether a pointer sits on the painted card, not in the padded gap.
 *
 * Slot width includes the space between avatars. Using that for a hit
 * made a click in the gap open the centre card.
 *
 * @param {number} pointerX
 * @param {number} planeX
 * @param {number} visualWidth The plane's scale.x, in the same units.
 * @returns {boolean}
 */
export function isPointerOnVisualCard(pointerX, planeX, visualWidth) {
  if (
    !Number.isFinite(pointerX) ||
    !Number.isFinite(planeX) ||
    !Number.isFinite(visualWidth) ||
    visualWidth <= 0
  ) {
    return false;
  }
  return Math.abs(pointerX - planeX) <= visualWidth / 2;
}

/**
 * Horizontal offset of the card closest to centre.
 *
 * Hide/settings sit under that card. Using the viewport centre while
 * the playhead was between avatars parked the icons in the gap.
 *
 * @param {number[]} offsets Plane x values in one unit system.
 * @returns {number}
 */
export function nearestCardOffset(offsets) {
  if (!Array.isArray(offsets) || offsets.length === 0) return 0;
  let nearest = offsets[0];
  for (const offset of offsets) {
    if (!Number.isFinite(offset)) continue;
    if (
      !Number.isFinite(nearest) ||
      Math.abs(offset) < Math.abs(nearest)
    ) {
      nearest = offset;
    }
  }
  return Number.isFinite(nearest) ? nearest : 0;
}

/**
 * Index of the painted card under the pointer, or -1 when it is in a gap.
 *
 * @param {number} pointerX
 * @param {Array<{x: number, visualWidth: number, index: number}>} cards
 * @returns {number}
 */
/**
 * Window-level gallery drag and wheel must ignore chrome that sits over
 * the canvas. The help pill is a portal on `document.body`; without this
 * check, dragging it also turns the carousel.
 *
 * @param {EventTarget|null|undefined} target
 * @returns {boolean}
 */
export function shouldIgnoreGalleryWindowPointer(target) {
  const element =
    target && typeof target.closest === 'function'
      ? target
      : target?.parentElement;
  if (!element || typeof element.closest !== 'function') return false;
  return Boolean(element.closest('[data-evan-assist-overlay]'));
}

export function visualCardIndexAtPointer(pointerX, cards) {
  if (!Array.isArray(cards) || !Number.isFinite(pointerX)) return -1;
  let bestIndex = -1;
  let bestDistance = Infinity;
  for (const card of cards) {
    if (!isPointerOnVisualCard(pointerX, card.x, card.visualWidth)) continue;
    const distance = Math.abs(pointerX - card.x);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = card.index;
    }
  }
  return bestIndex;
}
