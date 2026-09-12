// src/services/imageViewport.js
//
// Pan and zoom for a framed still or clip. Scale 1 shows the whole picture
// (object-fit: contain). Zooming in is what lets a face or a name on a sign
// fill the frame; dragging then moves that part.

export const IMAGE_VIEWPORT_MIN_SCALE = 1;
export const IMAGE_VIEWPORT_MAX_SCALE = 8;

export const IMAGE_VIEWPORT_RESET = Object.freeze({
  scale: IMAGE_VIEWPORT_MIN_SCALE,
  offsetX: 0,
  offsetY: 0,
});

const STORAGE_KEY = 'image_viewport';

/**
 * @param {number} scale
 * @returns {number}
 */
export function clampImageViewportScale(scale) {
  const numeric = Number(scale);
  if (!Number.isFinite(numeric)) return IMAGE_VIEWPORT_MIN_SCALE;
  return Math.min(
    IMAGE_VIEWPORT_MAX_SCALE,
    Math.max(IMAGE_VIEWPORT_MIN_SCALE, numeric)
  );
}

/**
 * How far the picture may slide at this scale without leaving empty frame.
 *
 * Contain (the default): the media is treated as filling the frame at scale 1.
 * Cover: at scale 1 a tall or wide picture already overflows, so it can slide.
 *
 * @param {number} scale
 * @param {{width?: number, height?: number, fit?: 'contain'|'cover', mediaWidth?: number, mediaHeight?: number}|null|undefined} frame
 * @returns {{maxX: number, maxY: number}}
 */
const finiteOrZero = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric === 0) return 0;
  return numeric;
};

/**
 * The box a picture occupies when it covers `frame` at scale 1.
 *
 * @param {{width?: number, height?: number}|null|undefined} frame
 * @param {{width?: number, height?: number}|null|undefined} media
 * @returns {{width: number, height: number}}
 */
export function imageViewportCoverSize(frame, media) {
  const frameWidth = Number(frame?.width);
  const frameHeight = Number(frame?.height);
  if (!(frameWidth > 0) || !(frameHeight > 0)) {
    return { width: 0, height: 0 };
  }
  const mediaWidth = Number(
    media?.mediaWidth ?? media?.width ?? frame?.mediaWidth
  );
  const mediaHeight = Number(
    media?.mediaHeight ?? media?.height ?? frame?.mediaHeight
  );
  if (!(mediaWidth > 0) || !(mediaHeight > 0)) {
    // Unknown media must not be forced into the frame's aspect — that is
    // what stretched portraits into the square bubble.
    return { width: 0, height: 0 };
  }
  const frameRatio = frameWidth / frameHeight;
  const mediaRatio = mediaWidth / mediaHeight;
  if (mediaRatio > frameRatio) {
    return { width: frameHeight * mediaRatio, height: frameHeight };
  }
  return { width: frameWidth, height: frameWidth / mediaRatio };
}

export function imageViewportPanLimit(scale, frame) {
  const width = Number(frame?.width);
  const height = Number(frame?.height);
  const safeScale = clampImageViewportScale(scale);
  if (!(width > 0) || !(height > 0)) {
    return { maxX: Number.POSITIVE_INFINITY, maxY: Number.POSITIVE_INFINITY };
  }
  if (frame?.fit === 'cover') {
    const cover = imageViewportCoverSize(frame, frame);
    return {
      maxX: Math.max(0, (cover.width * safeScale - width) / 2),
      maxY: Math.max(0, (cover.height * safeScale - height) / 2),
    };
  }
  return {
    maxX: Math.max(0, ((safeScale - 1) * width) / 2),
    maxY: Math.max(0, ((safeScale - 1) * height) / 2),
  };
}

/**
 * @param {{scale?: number, offsetX?: number, offsetY?: number}|null|undefined} viewport
 * @param {{width?: number, height?: number}|null|undefined} frame
 * @returns {{scale: number, offsetX: number, offsetY: number}}
 */
export function clampImageViewport(viewport, frame) {
  const scale = clampImageViewportScale(viewport?.scale);
  const { maxX, maxY } = imageViewportPanLimit(scale, frame);
  return {
    scale,
    offsetX: finiteOrZero(Math.min(maxX, Math.max(-maxX, Number(viewport?.offsetX)))),
    offsetY: finiteOrZero(Math.min(maxY, Math.max(-maxY, Number(viewport?.offsetY)))),
  };
}

/**
 * @param {{scale?: number, offsetX?: number, offsetY?: number}|null|undefined} viewport
 * @returns {boolean}
 */
export function imageViewportIsZoomed(viewport) {
  return clampImageViewportScale(viewport?.scale) > IMAGE_VIEWPORT_MIN_SCALE;
}

/**
 * Whether the picture can slide in this frame (zoomed, or a cover crop that
 * already overflows).
 *
 * @param {{scale?: number, offsetX?: number, offsetY?: number}|null|undefined} viewport
 * @param {{width?: number, height?: number, fit?: string}|null|undefined} frame
 * @returns {boolean}
 */
export function imageViewportCanPan(viewport, frame) {
  const { maxX, maxY } = imageViewportPanLimit(viewport?.scale, frame);
  return maxX > 0 || maxY > 0;
}

/**
 * Whether the person has moved the picture off the default fit.
 *
 * @param {{scale?: number, offsetX?: number, offsetY?: number}|null|undefined} viewport
 * @returns {boolean}
 */
export function imageViewportIsFramed(viewport) {
  return (
    imageViewportIsZoomed(viewport) ||
    finiteOrZero(viewport?.offsetX) !== 0 ||
    finiteOrZero(viewport?.offsetY) !== 0
  );
}

/**
 * Where a cover-fitted picture sits inside the frame.
 *
 * @param {{scale?: number, offsetX?: number, offsetY?: number}|null|undefined} viewport
 * @param {{width?: number, height?: number, mediaWidth?: number, mediaHeight?: number}|null|undefined} frame
 * @returns {{width: number, height: number, left: number, top: number}}
 */
export function imageViewportCoverLayout(viewport, frame) {
  const width = Number(frame?.width);
  const height = Number(frame?.height);
  const clamped = clampImageViewport(
    viewport,
    frame?.fit === 'cover' ? frame : { ...frame, fit: 'cover' }
  );
  const cover = imageViewportCoverSize(frame, frame);
  const paintedWidth = cover.width * clamped.scale;
  const paintedHeight = cover.height * clamped.scale;
  return {
    width: paintedWidth,
    height: paintedHeight,
    left: (width - paintedWidth) / 2 + clamped.offsetX,
    top: (height - paintedHeight) / 2 + clamped.offsetY,
  };
}

/**
 * @param {{scale?: number, offsetX?: number, offsetY?: number}|null|undefined} viewport
 * @returns {{transform: string, transformOrigin: string}}
 */
export function imageViewportCssTransform(viewport) {
  const scale = clampImageViewportScale(viewport?.scale);
  const offsetX = Number(viewport?.offsetX);
  const offsetY = Number(viewport?.offsetY);
  const x = Number.isFinite(offsetX) ? offsetX : 0;
  const y = Number.isFinite(offsetY) ? offsetY : 0;
  return {
    transform: `translate(${x}px, ${y}px) scale(${scale})`,
    transformOrigin: 'center center',
  };
}

/**
 * @param {{scale?: number, offsetX?: number, offsetY?: number}} viewport
 * @param {number} deltaX
 * @param {number} deltaY
 * @param {{width?: number, height?: number}|null|undefined} frame
 * @returns {{scale: number, offsetX: number, offsetY: number}}
 */
export function panImageViewport(viewport, deltaX, deltaY, frame) {
  const current = clampImageViewport(viewport, frame);
  const shiftX = Number(deltaX);
  const shiftY = Number(deltaY);
  return clampImageViewport(
    {
      scale: current.scale,
      offsetX: current.offsetX + (Number.isFinite(shiftX) ? shiftX : 0),
      offsetY: current.offsetY + (Number.isFinite(shiftY) ? shiftY : 0),
    },
    frame
  );
}

/**
 * Zoom while keeping the point under `origin` (frame-local pixels) still.
 *
 * @param {{scale?: number, offsetX?: number, offsetY?: number}} viewport
 * @param {number} nextScale
 * @param {{x?: number, y?: number}|null|undefined} origin
 * @param {{width?: number, height?: number}|null|undefined} frame
 * @returns {{scale: number, offsetX: number, offsetY: number}}
 */
export function zoomImageViewport(viewport, nextScale, origin, frame) {
  const current = clampImageViewport(viewport, frame);
  const scale = clampImageViewportScale(nextScale);
  if (scale === current.scale) {
    return current;
  }
  const width = Number(frame?.width);
  const height = Number(frame?.height);
  const originX = Number(origin?.x);
  const originY = Number(origin?.y);
  const centerX = width > 0 ? width / 2 : 0;
  const centerY = height > 0 ? height / 2 : 0;
  const fromCenterX = Number.isFinite(originX) ? originX - centerX : 0;
  const fromCenterY = Number.isFinite(originY) ? originY - centerY : 0;
  const ratio = scale / current.scale;
  return clampImageViewport(
    {
      scale,
      offsetX: fromCenterX - (fromCenterX - current.offsetX) * ratio,
      offsetY: fromCenterY - (fromCenterY - current.offsetY) * ratio,
    },
    frame
  );
}

/**
 * Wheel-delta to a new scale. Negative delta (scroll up) zooms in.
 *
 * @param {number} currentScale
 * @param {number} deltaY
 * @returns {number}
 */
export function imageViewportScaleAfterWheel(currentScale, deltaY) {
  const delta = Number(deltaY);
  if (!Number.isFinite(delta) || delta === 0) {
    return clampImageViewportScale(currentScale);
  }
  const factor = Math.exp(-delta * 0.0015);
  return clampImageViewportScale(currentScale * factor);
}

/**
 * @param {number} currentScale
 * @param {number} previousDistance
 * @param {number} nextDistance
 * @returns {number}
 */
export function imageViewportScaleAfterPinch(
  currentScale,
  previousDistance,
  nextDistance
) {
  const previous = Number(previousDistance);
  const next = Number(nextDistance);
  if (!(previous > 0) || !(next > 0)) {
    return clampImageViewportScale(currentScale);
  }
  return clampImageViewportScale(currentScale * (next / previous));
}

/**
 * One step on the + / − buttons.
 *
 * @param {number} currentScale
 * @param {1|-1} direction
 * @returns {number}
 */
export function imageViewportScaleAfterStep(currentScale, direction) {
  const step = direction < 0 ? 1 / 1.25 : 1.25;
  return clampImageViewportScale(currentScale * step);
}

/**
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @returns {number}
 */
export function imageViewportPointerDistance(x1, y1, x2, y2) {
  const dx = Number(x2) - Number(x1);
  const dy = Number(y2) - Number(y1);
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return 0;
  return Math.hypot(dx, dy);
}

/**
 * @param {unknown} value
 * @returns {{scale: number, offsetX: number, offsetY: number}|null}
 */
export function parseStoredImageViewport(value) {
  if (!value || typeof value !== 'object') return null;
  const scale = Number(value.scale);
  const offsetX = Number(value.offsetX);
  const offsetY = Number(value.offsetY);
  if (
    !Number.isFinite(scale) ||
    !Number.isFinite(offsetX) ||
    !Number.isFinite(offsetY)
  ) {
    return null;
  }
  return { scale, offsetX, offsetY };
}

/**
 * @param {string|null|undefined} persistKey
 * @param {Storage|null|undefined} [storage]
 * @returns {{scale: number, offsetX: number, offsetY: number}}
 */
export function readImageViewport(
  persistKey,
  storage = globalThis.localStorage
) {
  if (!persistKey) return { ...IMAGE_VIEWPORT_RESET };
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return { ...IMAGE_VIEWPORT_RESET };
    const book = JSON.parse(raw);
    return (
      parseStoredImageViewport(book?.[persistKey]) ?? {
        ...IMAGE_VIEWPORT_RESET,
      }
    );
  } catch {
    return { ...IMAGE_VIEWPORT_RESET };
  }
}

/**
 * @param {string|null|undefined} persistKey
 * @param {{scale?: number, offsetX?: number, offsetY?: number}} viewport
 * @param {Storage|null|undefined} [storage]
 */
export function writeImageViewport(
  persistKey,
  viewport,
  storage = globalThis.localStorage
) {
  if (!persistKey) return;
  try {
    let book = {};
    const raw = storage?.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') book = parsed;
    }
    book[persistKey] = clampImageViewport(viewport, null);
    storage?.setItem(STORAGE_KEY, JSON.stringify(book));
  } catch {
    // Private mode and a full quota both refuse writes.
  }
}
