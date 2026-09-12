// The crop everyone should see on an avatar's picture.
//
// The owner frames it in Avatar Settings. That framing is stored on the
// avatar so profile bubbles, voice mode, and every other visitor paint the
// same part of the photograph. localStorage is only a same-tab cache.

import { requestJson } from './neuralNexusApiClient.js';
import {
  normalizeProfileBubbleViewport,
  writeProfileBubbleViewport,
} from './profileBubbleViewport.js';

const rememberedViewports = new Map();
const pendingSaves = new Map();
const SAVE_DELAY_MS = 500;

/**
 * @param {unknown} value
 * @returns {{scale: number, x: number, y: number, mediaWidth?: number, mediaHeight?: number}|null}
 */
export function parseAvatarImageViewport(value) {
  if (!value || typeof value !== 'object') return null;
  const scale = Number(value.scale);
  const hasNormalized =
    Number.isFinite(Number(value.x)) || Number.isFinite(Number(value.y));
  const x = Number(hasNormalized ? value.x : 0);
  const y = Number(hasNormalized ? value.y : 0);
  if (!Number.isFinite(scale) || !Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  const parsed = { scale, x, y };
  const mediaWidth = Number(value.mediaWidth ?? value.media_width);
  const mediaHeight = Number(value.mediaHeight ?? value.media_height);
  if (mediaWidth > 0 && mediaHeight > 0) {
    parsed.mediaWidth = mediaWidth;
    parsed.mediaHeight = mediaHeight;
  }
  return parsed;
}

/**
 * @param {Object|null|undefined} avatar
 * @returns {{scale: number, x: number, y: number, mediaWidth?: number, mediaHeight?: number}|null}
 */
export function imageViewportFromAvatar(avatar) {
  if (!avatar || typeof avatar !== 'object') return null;
  return (
    parseAvatarImageViewport(avatar.metadata?.image_viewport) ??
    parseAvatarImageViewport(avatar.image_viewport)
  );
}

/**
 * @param {Object|null|undefined} avatar
 * @returns {string|null}
 */
export function assistantIdOfAvatar(avatar) {
  const id = avatar?.assistant_id ?? avatar?.avatar_id;
  const trimmed = String(id ?? '').trim();
  return trimmed || null;
}

/**
 * @param {string|null|undefined} assistantId
 * @param {{scale?: number, x?: number, y?: number, mediaWidth?: number, mediaHeight?: number}|null|undefined} viewport
 */
export function rememberAvatarImageViewport(assistantId, viewport) {
  const id = String(assistantId ?? '').trim();
  const parsed = parseAvatarImageViewport(viewport);
  if (!id || !parsed) return;
  rememberedViewports.set(id, parsed);
}

/**
 * @param {Array|null|undefined} avatars
 */
export function rememberImageViewportsFromAvatars(avatars) {
  if (!Array.isArray(avatars)) return;
  for (const avatar of avatars) {
    rememberAvatarImageViewport(
      assistantIdOfAvatar(avatar),
      imageViewportFromAvatar(avatar)
    );
  }
}

/**
 * @param {string|null|undefined} assistantId
 * @returns {{scale: number, x: number, y: number, mediaWidth?: number, mediaHeight?: number}|null}
 */
export function rememberedAvatarImageViewport(assistantId) {
  const id = String(assistantId ?? '').trim();
  if (!id) return null;
  return rememberedViewports.get(id) ?? null;
}

/**
 * @param {string} assistantId
 * @param {{scale?: number, offsetX?: number, offsetY?: number, mediaWidth?: number, mediaHeight?: number}} viewport
 * @param {{width?: number, height?: number}|null|undefined} frame
 * @returns {Promise<Object>}
 */
export async function saveAvatarImageViewport(assistantId, viewport, frame) {
  const id = String(assistantId ?? '').trim();
  if (!id) return null;
  const normalized = normalizeProfileBubbleViewport(viewport, frame);
  rememberAvatarImageViewport(id, normalized);
  writeProfileBubbleViewport(id, viewport, frame);
  return requestJson('/avatar_image_viewport', {
    method: 'POST',
    body: {
      assistant_id: id,
      ...normalized,
    },
  });
}

/**
 * @param {string} assistantId
 * @param {{scale?: number, offsetX?: number, offsetY?: number, mediaWidth?: number, mediaHeight?: number}} viewport
 * @param {{width?: number, height?: number}|null|undefined} frame
 */
export function scheduleAvatarImageViewportSave(assistantId, viewport, frame) {
  const id = String(assistantId ?? '').trim();
  if (!id) return;
  const pending = pendingSaves.get(id);
  if (pending) clearTimeout(pending);
  pendingSaves.set(
    id,
    setTimeout(() => {
      pendingSaves.delete(id);
      saveAvatarImageViewport(id, viewport, frame).catch((saveError) => {
        console.debug('Could not save the avatar picture framing:', saveError);
      });
    }, SAVE_DELAY_MS)
  );
}

export function resetAvatarImageViewportMemoryForTests() {
  rememberedViewports.clear();
  for (const timeout of pendingSaves.values()) clearTimeout(timeout);
  pendingSaves.clear();
}
