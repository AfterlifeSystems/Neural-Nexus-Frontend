// src/services/profileBubbleViewport.js
//
// The crop on an avatar's profile bubble: which part of the reference image
// sits in the circle. Framed in Avatar Settings; every bubble reads the same
// numbers.

import {
  IMAGE_VIEWPORT_RESET,
  clampImageViewport,
  imageViewportCoverLayout,
  parseStoredImageViewport,
} from './imageViewport.js';

const STORAGE_KEY = 'image_viewport';

export const PROFILE_BUBBLE_VIEWPORT_EVENT = 'profile-bubble-viewport';

/**
 * @param {string|null|undefined} assistantId
 * @returns {string|null}
 */
export function profileBubblePersistKey(assistantId) {
  const id = String(assistantId ?? '').trim();
  return id ? `profile-bubble:${id}` : null;
}

/**
 * @param {string|null|undefined} persistKey
 * @returns {string|null}
 */
export function assistantIdFromProfileBubbleKey(persistKey) {
  const key = String(persistKey ?? '');
  return key.startsWith('profile-bubble:')
    ? key.slice('profile-bubble:'.length)
    : null;
}

/**
 * @param {{scale?: number, offsetX?: number, offsetY?: number, mediaWidth?: number, mediaHeight?: number}|null|undefined} viewport
 * @param {{width?: number, height?: number}|null|undefined} frame
 * @returns {{scale: number, x: number, y: number, mediaWidth: number|null, mediaHeight: number|null}}
 */
export function normalizeProfileBubbleViewport(viewport, frame) {
  const width = Number(frame?.width);
  const height = Number(frame?.height);
  const mediaWidth = Number(viewport?.mediaWidth ?? frame?.mediaWidth);
  const mediaHeight = Number(viewport?.mediaHeight ?? frame?.mediaHeight);
  return {
    scale: viewport?.scale ?? IMAGE_VIEWPORT_RESET.scale,
    x: width > 0 ? Number(viewport?.offsetX ?? 0) / width : Number(viewport?.x ?? 0),
    y: height > 0 ? Number(viewport?.offsetY ?? 0) / height : Number(viewport?.y ?? 0),
    mediaWidth: mediaWidth > 0 ? mediaWidth : null,
    mediaHeight: mediaHeight > 0 ? mediaHeight : null,
  };
}

/**
 * @param {unknown} value
 * @param {{width?: number, height?: number}|null|undefined} frame
 * @returns {{scale: number, offsetX: number, offsetY: number, mediaWidth?: number, mediaHeight?: number}}
 */
export function denormalizeProfileBubbleViewport(value, frame) {
  const width = Number(frame?.width);
  const height = Number(frame?.height);
  const stored = value && typeof value === 'object' ? value : {};
  const hasNormalized = Number.isFinite(Number(stored.x)) || Number.isFinite(Number(stored.y));
  const pixels = hasNormalized
    ? {
        scale: stored.scale,
        offsetX: Number(stored.x ?? 0) * (width > 0 ? width : 0),
        offsetY: Number(stored.y ?? 0) * (height > 0 ? height : 0),
      }
    : parseStoredImageViewport(stored) ?? { ...IMAGE_VIEWPORT_RESET };
  const mediaWidth = Number(stored.mediaWidth);
  const mediaHeight = Number(stored.mediaHeight);
  const media = {
    mediaWidth: mediaWidth > 0 ? mediaWidth : frame?.mediaWidth,
    mediaHeight: mediaHeight > 0 ? mediaHeight : frame?.mediaHeight,
  };
  return {
    ...clampImageViewport(
      {
        ...pixels,
        ...media,
      },
      {
        ...frame,
        fit: 'cover',
        ...media,
      }
    ),
    ...media,
  };
}

/**
 * @param {string|null|undefined} assistantId
 * @param {{width?: number, height?: number}|null|undefined} [frame]
 * @param {Storage|null|undefined} [storage]
 */
export function readProfileBubbleViewport(
  assistantId,
  frame = null,
  storage = globalThis.localStorage
) {
  const persistKey = profileBubblePersistKey(assistantId);
  if (!persistKey) {
    return { ...IMAGE_VIEWPORT_RESET };
  }
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return { ...IMAGE_VIEWPORT_RESET };
    const book = JSON.parse(raw);
    return denormalizeProfileBubbleViewport(book?.[persistKey], frame);
  } catch {
    return { ...IMAGE_VIEWPORT_RESET };
  }
}

/**
 * @param {string|null|undefined} assistantId
 * @param {{scale?: number, offsetX?: number, offsetY?: number, mediaWidth?: number, mediaHeight?: number}} viewport
 * @param {{width?: number, height?: number, mediaWidth?: number, mediaHeight?: number}|null|undefined} frame
 * @param {Storage|null|undefined} [storage]
 */
export function writeProfileBubbleViewport(
  assistantId,
  viewport,
  frame,
  storage = globalThis.localStorage
) {
  const persistKey = profileBubblePersistKey(assistantId);
  if (!persistKey) return;
  const normalized = normalizeProfileBubbleViewport(viewport, frame);
  try {
    let book = {};
    const raw = storage?.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') book = parsed;
    }
    book[persistKey] = normalized;
    storage?.setItem(STORAGE_KEY, JSON.stringify(book));
  } catch {
    // Private mode and a full quota both refuse writes.
  }
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(PROFILE_BUBBLE_VIEWPORT_EVENT, {
      detail: { assistantId: String(assistantId) },
    })
  );
}

/**
 * @param {string|null|undefined} assistantId
 * @param {(viewport: {scale: number, offsetX: number, offsetY: number}) => void} onChange
 * @returns {() => void}
 */
export function subscribeProfileBubbleViewport(assistantId, onChange) {
  if (typeof window === 'undefined') return () => {};
  const expected = String(assistantId ?? '');
  const handle = (event) => {
    if (expected && event.detail?.assistantId !== expected) return;
    onChange(readProfileBubbleViewport(assistantId));
  };
  window.addEventListener(PROFILE_BUBBLE_VIEWPORT_EVENT, handle);
  return () => window.removeEventListener(PROFILE_BUBBLE_VIEWPORT_EVENT, handle);
}

/**
 * @param {{scale?: number, offsetX?: number, offsetY?: number, mediaWidth?: number, mediaHeight?: number}|null|undefined} viewport
 * @param {{width: number, height: number}} frame
 * @returns {{width: number, height: number, left: number, top: number}}
 */
export function profileBubbleCoverLayout(viewport, frame) {
  return imageViewportCoverLayout(viewport, {
    ...frame,
    fit: 'cover',
    mediaWidth: viewport?.mediaWidth ?? frame?.mediaWidth,
    mediaHeight: viewport?.mediaHeight ?? frame?.mediaHeight,
  });
}

