// src/config/avatarShareControl.js
//
// Whether this avatar may open the camera to take a look, and switch a share
// off, without waiting to be asked each time.
//
// The permission is per browser, not per account, and deliberately so: it is a
// permission over THIS device's camera, and granting it on a laptop must not
// arm it on a phone the owner never thought about. The browser that holds the
// permission is also the browser that enforces it — the API is told on each
// turn only so the avatar is offered the tools at all.
//
// **There is deliberately no matching permission for the screen.** A camera
// needs one because a granted camera permission persists on the origin, so the
// avatar really can reopen the camera on its own and something has to say
// whether it may. A screen is the opposite: no browser lets a page start a
// capture, `getDisplayMedia` needs a real gesture every time, and none keeps a
// standing grant — so every screen peek already requires the person to press
// something and choose, in the browser's own picker, exactly what the avatar
// will see. A standing permission there would govern something that cannot
// happen without a fresh deliberate act anyway. The screen is offered from the
// share control instead (see `SidebarShareControls`), which is where the
// person turns screen sharing on and off.

const STORAGE_KEY = 'avatar_share_control';
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
export function readAvatarShareControlStore(storage) {
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
 * Whether this avatar may open the camera and switch shares off, in this browser.
 *
 * Unset avatars are off: the avatar reaching for a camera is something the
 * owner turns on, never a default.
 *
 * @param {string|null|undefined} assistantId
 * @param {Storage|null|undefined} [storage]
 * @returns {boolean}
 */
export function readAvatarShareControl(assistantId, storage) {
  const id = assistantIdOf(assistantId);
  if (!id) return false;
  // A browser may hold either shape: a bare boolean, or the `{camera}` object a
  // short-lived version of this setting wrote. Both meant the camera.
  const entry = readAvatarShareControlStore(storage)[id];
  if (entry && typeof entry === 'object') return Boolean(entry.camera);
  return Boolean(entry);
}

/**
 * @param {string|null|undefined} assistantId
 * @param {boolean} allowed
 * @param {Storage|null|undefined} [storage]
 * @returns {boolean}
 */
export function writeAvatarShareControl(assistantId, allowed, storage) {
  const next = Boolean(allowed);
  const id = assistantIdOf(assistantId);
  if (!id) return next;
  const store = storageOf(storage);
  const current = readAvatarShareControlStore(store);
  try {
    store?.setItem(STORAGE_KEY, JSON.stringify({ ...current, [id]: next }));
  } catch {
    // Private mode / quota: the choice then lasts only for this page.
  }
  for (const listener of listeners) listener(id, next);
  return next;
}

/**
 * @param {Function} listener Called with `(assistantId, allowed)` after a write.
 * @returns {Function} Unsubscribe.
 */
export function subscribeAvatarShareControl(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
