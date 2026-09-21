import { imageViewportContainLayout } from '../services/imageViewport.js';

/** Circle disc, the same silhouette as the message portraits. */
export const GALLERY_AVATAR_BORDER_RADIUS = 0.5;

/**
 * Corner rounding for a contained 9:16 portrait in the square plane, in
 * plane UV. Near CSS `rounded-2xl` on the voice-stage well.
 */
export const GALLERY_PORTRAIT_BORDER_RADIUS = 0.045;

/** Create Avatar stays a rounded square so the live PixelCard overlay matches. */
export const GALLERY_CREATE_BORDER_RADIUS = 0.05;

/** Desktop discs fill this fraction of the gallery's height. */
export const GALLERY_CARD_HEIGHT_FRACTION = 0.66;

/**
 * A tall phone gallery makes a height-based disc wider than the screen.
 * Cap at this fraction of gallery width so the centre portrait stays the
 * hero and the next faces still peek — with enough leftover for a real gap
 * between discs. 0.76 left only ~7px of padding on a 358px phone.
 */
export const GALLERY_CARD_MAX_WIDTH_FRACTION = 0.62;

/**
 * Gap between discs as a fraction of card size. Matches the old world
 * padding of 2 on a 0.6-height card (~0.20 of the painted disc).
 */
export const GALLERY_CARD_PADDING_FRACTION = 0.2;

/**
 * Floor for the gap between discs on a narrow gallery, as a fraction of
 * card size. Without this, peek budgeting ate the padding down to a few
 * pixels and the faces sat on top of each other on mobile.
 */
export const GALLERY_CARD_MIN_PADDING_FRACTION = 0.12;

/** Visible sliver of each neighboring disc, in CSS pixels. */
export const GALLERY_CARD_NEIGHBOR_PEEK_PIXELS = 36;

/**
 * Height of the gallery box so discs still fill the desktop fraction.
 *
 * On a tall phone the discs are width-capped so neighbors peek. If the
 * box still stretches through the leftover viewport, that cap leaves
 * empty bands above and below the faces. Shrink the box to the height
 * the width-capped disc would occupy at the desktop fill fraction.
 * Wide screens keep the leftover height because the height-based disc
 * already fits.
 *
 * @param {number} containerWidth Gallery CSS width.
 * @param {number} availableHeight Height left after search and the
 *   thumbnail strip.
 * @returns {number}
 */
export function galleryFrameHeight(containerWidth, availableHeight) {
  const available = Math.max(Number(availableHeight) || 0, 0);
  const width = Number(containerWidth) || 0;
  // A 0-width pass used to be treated as 1px, which shrinks a full
  // leftover column to a sliver. The Create overlay still paints in
  // that sliver; the WebGL discs do not.
  if (width < 2) return available;
  const preferred =
    (GALLERY_CARD_MAX_WIDTH_FRACTION * width) / GALLERY_CARD_HEIGHT_FRACTION;
  return Math.min(available, preferred);
}

/**
 * Whether the gallery box is large enough to start WebGL.
 *
 * A 0×0 (or 1px) first paint is common on the SPA click into /avatars: the
 * frame has no height until this file's measure runs, and constructing the
 * OGL renderer there writes a NaN camera aspect. The discs then stay
 * invisible even after the box later gets a size. A refresh works because
 * the avatar list arrives after layout and the scene is built a second time.
 *
 * @param {number} width CSS width.
 * @param {number} height CSS height.
 * @returns {boolean}
 */
export function galleryBoxIsPainted(width, height) {
  return Number(width) >= 2 && Number(height) >= 2;
}

/**
 * Painted disc size and gap for a gallery container.
 *
 * Wide screens keep the height-fraction discs. Narrow/tall screens cap the
 * disc to the width fraction and pull the gap in until neighbors peek.
 *
 * @param {number} containerWidth Gallery CSS width.
 * @param {number} containerHeight Gallery CSS height.
 * @returns {{pixelSize: number, paddingPixels: number, heightFraction: number}}
 */
export function galleryCardLayout(containerWidth, containerHeight) {
  const width = Math.max(Number(containerWidth) || 0, 1);
  const height = Math.max(Number(containerHeight) || 0, 1);
  const pixelSize = Math.min(
    GALLERY_CARD_HEIGHT_FRACTION * height,
    GALLERY_CARD_MAX_WIDTH_FRACTION * width
  );
  const leftoverEachSide = Math.max((width - pixelSize) / 2, 0);
  const fullPadding = pixelSize * GALLERY_CARD_PADDING_FRACTION;
  const minPadding = pixelSize * GALLERY_CARD_MIN_PADDING_FRACTION;
  let paddingPixels;
  if (leftoverEachSide <= GALLERY_CARD_NEIGHBOR_PEEK_PIXELS) {
    paddingPixels = Math.max(leftoverEachSide * 0.2, Math.min(minPadding, leftoverEachSide * 0.45), 4);
  } else {
    const peekBudget = leftoverEachSide - GALLERY_CARD_NEIGHBOR_PEEK_PIXELS;
    paddingPixels = Math.min(
      fullPadding,
      Math.max(peekBudget, minPadding, 4)
    );
  }
  return {
    pixelSize,
    paddingPixels,
    heightFraction: pixelSize / height,
  };
}

/**
 * The same layout in the gallery camera's world units.
 *
 * @param {number} containerWidth
 * @param {number} containerHeight
 * @param {number} viewportWidth
 * @param {number} viewportHeight
 * @returns {{pixelSize: number, paddingPixels: number, heightFraction: number, cardWorld: number, paddingWorld: number}}
 */
export function galleryCardWorldLayout(
  containerWidth,
  containerHeight,
  viewportWidth,
  viewportHeight
) {
  const layout = galleryCardLayout(containerWidth, containerHeight);
  const safeHeight = Math.max(Number(containerHeight) || 0, 1);
  const safeWidth = Math.max(Number(containerWidth) || 0, 1);
  return {
    ...layout,
    cardWorld:
      (layout.pixelSize / safeHeight) * Math.max(Number(viewportHeight) || 0, 0),
    paddingWorld:
      (layout.paddingPixels / safeWidth) * Math.max(Number(viewportWidth) || 0, 0),
  };
}

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
 * Window-level gallery drag and wheel must ignore chrome that sits over
 * the canvas. The help pill is a portal on `document.body`; User Settings
 * opens upward over the hide / inbox / settings strip. Without this check,
 * a press on either also turns the carousel.
 */
export const GALLERY_WINDOW_POINTER_IGNORE_SELECTOR =
  '[data-evan-assist-overlay], [data-user-settings-menu]';

/**
 * @param {EventTarget|null|undefined} target
 * @returns {boolean}
 */
export function shouldIgnoreGalleryWindowPointer(target) {
  const element =
    target && typeof target.closest === 'function'
      ? target
      : target?.parentElement;
  if (!element || typeof element.closest !== 'function') return false;
  return Boolean(element.closest(GALLERY_WINDOW_POINTER_IGNORE_SELECTOR));
}

/**
 * UV scale for covering a gallery plane (CSS object-cover).
 *
 * @param {number} planeWidth
 * @param {number} planeHeight
 * @param {number} imageWidth
 * @param {number} imageHeight
 * @returns {{x: number, y: number}}
 */
export function galleryCoverUvRatio(
  planeWidth,
  planeHeight,
  imageWidth,
  imageHeight
) {
  const planeAspect =
    Math.max(Number(planeWidth) || 0, 0.0001) /
    Math.max(Number(planeHeight) || 0, 0.0001);
  const imageAspect =
    Math.max(Number(imageWidth) || 0, 0.0001) /
    Math.max(Number(imageHeight) || 0, 0.0001);
  return {
    x: Math.min(planeAspect / imageAspect, 1),
    y: Math.min(imageAspect / planeAspect, 1),
  };
}

/**
 * Texture coordinate at a plane UV for a cover crop.
 *
 * @param {number} planeU
 * @param {number} planeV
 * @param {{x: number, y: number}} ratio
 * @returns {{x: number, y: number}}
 */
export function galleryCoverUv(planeU, planeV, ratio) {
  const scaleX = Number(ratio?.x);
  const scaleY = Number(ratio?.y);
  return {
    x: planeU * scaleX + (1 - scaleX) * 0.5,
    y: planeV * scaleY + (1 - scaleY) * 0.5,
  };
}

/**
 * Circle when the photo fills the square plane; rounded-2xl when a 9:16
 * portrait is contained so the whole generated clip is visible.
 *
 * @param {number} sizeX Photo width in plane UV.
 * @param {number} sizeY Photo height in plane UV.
 * @returns {number}
 */
export function galleryMediaBorderRadius(sizeX, sizeY) {
  const width = Number(sizeX);
  const height = Number(sizeY);
  if (!(width > 0) || !(height > 0)) return GALLERY_AVATAR_BORDER_RADIUS;
  if (width >= 0.95 && height >= 0.95) return GALLERY_AVATAR_BORDER_RADIUS;
  return GALLERY_PORTRAIT_BORDER_RADIUS;
}

/**
 * Where the photograph sits on the gallery plane.
 *
 * Always contain the whole still or clip, centered. Cover-plus-bubble-crop
 * used to paint the message-bubble zoom on the large disc whenever the
 * owner framed a tight headshot — that made personal-avatar reference
 * photos look too close next to tall Mom/Dad portraits that already
 * contained. Message bubbles keep the framed crop via ProfileBubbleImage;
 * the carousel shows the full photograph.
 *
 * @param {number} imageWidth
 * @param {number} imageHeight
 * @param {{scale?: number, offsetX?: number, offsetY?: number, mediaWidth?: number, mediaHeight?: number}|null|undefined} [_viewport]
 *   Ignored. Kept so older call sites that pass the bubble crop still compile.
 * @returns {{originX: number, originY: number, sizeX: number, sizeY: number}}
 */
export function galleryPortraitUvRect(
  imageWidth,
  imageHeight,
  _viewport = null
) {
  const mediaWidth = Number(imageWidth);
  const mediaHeight = Number(imageHeight);
  if (!(mediaWidth > 0) || !(mediaHeight > 0)) {
    return { originX: 0, originY: 0, sizeX: 1, sizeY: 1 };
  }
  const contained = imageViewportContainLayout(
    { width: 1, height: 1 },
    { mediaWidth, mediaHeight }
  );
  if (contained.width > 0 && contained.height > 0) {
    return {
      originX: contained.left,
      originY: contained.top,
      sizeX: contained.width,
      sizeY: contained.height,
    };
  }
  return { originX: 0, originY: 0, sizeX: 1, sizeY: 1 };
}

/**
 * Texture coordinate at a gallery plane UV for the Settings crop.
 *
 * Settings and message portraits use CSS space: y=0 is the top of the
 * photograph. The WebGL plane has v=0 at the bottom, and the texture is
 * uploaded with flipY, so both axes have to be reversed or pan/zoom land
 * on the opposite side of the face.
 *
 * @param {number} planeU WebGL u, 0 at the left.
 * @param {number} planeV WebGL v, 0 at the bottom.
 * @param {{originX: number, originY: number, sizeX: number, sizeY: number}} rect
 * @returns {{x: number, y: number}}
 */
export function galleryPortraitUv(planeU, planeV, rect) {
  const sizeX = Number(rect?.sizeX) || 1;
  const sizeY = Number(rect?.sizeY) || 1;
  const cssU = planeU;
  const cssV = 1 - planeV;
  const photoFromTopX = (cssU - Number(rect?.originX)) / sizeX;
  const photoFromTopY = (cssV - Number(rect?.originY)) / sizeY;
  return {
    x: photoFromTopX,
    y: 1 - photoFromTopY,
  };
}

/**
 * Index of the painted card under the pointer, or -1 when it is in a gap.
 *
 * @param {number} pointerX
 * @param {Array<{x: number, visualWidth: number, index: number}>} cards
 * @returns {number}
 */
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

/**
 * Decode the idle loop only for cards near the playhead.
 *
 * Starting every 720p clip when the tape is built is what froze the
 * carousel for a few seconds, then swapped every face at once. Neighbours
 * already peek into the viewport, so the next swipe is still pre-buffered.
 *
 * @param {number} planeX Card centre in viewport units.
 * @param {number} viewportWidth
 * @returns {boolean}
 */
export function galleryCardShouldDecodeIdleLoop(planeX, viewportWidth) {
  const x = Number(planeX);
  const width = Number(viewportWidth);
  if (!Number.isFinite(x) || !Number.isFinite(width) || width <= 0) {
    return false;
  }
  return Math.abs(x) <= width;
}

/**
 * The fields the WebGL gallery actually samples from an items row.
 *
 * @param {object|null|undefined} left
 * @param {object|null|undefined} right
 * @returns {boolean}
 */
export function galleryCardSourcesMatch(left, right) {
  if (left === right) return true;
  if (!left || !right) return false;
  return (
    left.id === right.id &&
    left.type === right.type &&
    left.image === right.image &&
    left.video === right.video &&
    left.text === right.text &&
    Boolean(left.portraitLoop) === Boolean(right.portraitLoop)
  );
}

/**
 * Aspect used for the 9:16 generated-loop window before the clip has a frame.
 *
 * @type {number}
 */
export const GALLERY_GENERATED_PORTRAIT_WIDTH = 9;

/**
 * @type {number}
 */
export const GALLERY_GENERATED_PORTRAIT_HEIGHT = 16;

/**
 * Whether this card should keep the 9:16 portrait frame instead of the
 * circular still. A square still in the disc is the round window that
 * appears before the generated loop.
 *
 * @param {{showGenerated?: boolean, loopUrl?: string|null, loopLookupSettled?: boolean}} parameters
 * @returns {boolean}
 */
export function galleryCardExpectsPortraitLoop({
  showGenerated = false,
  loopUrl = null,
  loopLookupSettled = false,
} = {}) {
  if (!showGenerated) return false;
  if (loopUrl) return true;
  return !loopLookupSettled;
}

/**
 * Whether the gallery may bind a face onto a card.
 *
 * A generated still may fill the 9:16 window while the idle loop catches up
 * (framed as a portrait, not a circle). Blocking every still left either a
 * blank disc or the circular reference photo on screen until mobile video
 * decode finished. With no still yet, generated cards stay on the placeholder
 * until a loop frame exists.
 *
 * @param {{portraitLoop?: boolean, loopHasFrame?: boolean, loopFailed?: boolean, stillReady?: boolean, hasStill?: boolean, hasLoopUrl?: boolean}} parameters
 * @returns {boolean}
 */
export function galleryCardMayReveal({
  portraitLoop = false,
  loopHasFrame = false,
  loopFailed = false,
  stillReady = false,
  hasStill = false,
  hasLoopUrl: _hasLoopUrl = false,
} = {}) {
  if (loopHasFrame) return true;
  if (hasStill && stillReady) return true;
  if (portraitLoop && !loopFailed) return false;
  return false;
}

/**
 * @param {Array<object>|null|undefined} left
 * @param {Array<object>|null|undefined} right
 * @returns {boolean}
 */
export function galleryItemListSourcesMatch(left, right) {
  if (left === right) return true;
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;
  return left.every((item, index) =>
    galleryCardSourcesMatch(item, right[index])
  );
}

/**
 * Same cards in the same order, so sources can be patched in place.
 *
 * @param {Array<object>|null|undefined} left
 * @param {Array<object>|null|undefined} right
 * @returns {boolean}
 */
export function galleryItemListSameIds(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;
  return left.every((item, index) => item?.id === right[index]?.id);
}
