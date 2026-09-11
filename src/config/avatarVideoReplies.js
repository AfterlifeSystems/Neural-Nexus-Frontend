// src/config/avatarVideoReplies.js
//
// Whether voice mode generates a lip-synced video of each spoken reply.
// This is an avatar setting, not a live-stage control: turning it on spends
// at the video vendor per second of speech, so the owner confirms the cost
// on the settings screen before any clip is made. Each avatar has its own
// choice. Unset avatars stay off.

const STORAGE_KEY = 'avatar_video_replies';
const listeners = new Set();

/**
 * @param {unknown} [storage]
 * @returns {Storage|null}
 */
function storageOf(storage) {
  if (storage === undefined) return globalThis.localStorage ?? null;
  return storage ?? null;
}

function assistantIdOf(assistantId) {
  return typeof assistantId === 'string' ? assistantId.trim() : '';
}

/**
 * @param {Storage|null|undefined} [storage]
 * @returns {Record<string, boolean>}
 */
export function readAvatarVideoRepliesStore(storage) {
  try {
    const raw = storageOf(storage)?.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

/**
 * @param {string|null|undefined} assistantId
 * @param {Storage|null|undefined} [storage]
 * @returns {boolean}
 */
export function readAvatarVideoReplies(assistantId, storage) {
  const id = assistantIdOf(assistantId);
  if (!id) return false;
  return Boolean(readAvatarVideoRepliesStore(storage)[id]);
}

/**
 * @param {string|null|undefined} assistantId
 * @param {boolean} enabled
 * @param {Storage|null|undefined} [storage]
 * @returns {boolean}
 */
export function writeAvatarVideoReplies(assistantId, enabled, storage) {
  const next = Boolean(enabled);
  const id = assistantIdOf(assistantId);
  if (!id) return next;
  const store = storageOf(storage);
  const current = readAvatarVideoRepliesStore(store);
  try {
    store?.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...current, [id]: next })
    );
  } catch {
    // Private mode / quota: the choice then lasts only for this page.
  }
  for (const listener of listeners) listener(id, next);
  return next;
}

/**
 * @param {Function} listener Called with `(assistantId, enabled)` after a write.
 * @returns {Function} Unsubscribe.
 */
export function subscribeAvatarVideoReplies(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
