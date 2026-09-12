// src/config/motionMeshDeveloperOverlay.js
//
// The developer option that draws the motion wireframe — the 478-vertex face
// mesh and the body skeleton — over the sidebar webcam preview.
//
// The mesh is a debugging view. It exists so that whoever is developing the
// motion pipeline can see, on their own face, that the landmarker loaded, that
// the mesh lands on the face rather than beside it, and that a dropped joint
// is dropped rather than drawn in the wrong place. It is not something a
// person using Neural Nexus should ever see over their own camera: the
// wireframe is unsettling, explains nothing to them, and the switch they hold
// is "Learn how I move" (src/config/motionCapture.js), which says what is
// happening in words.
//
// So the option is OFFERED only to the administrator in a development build —
// the same gate as the LangSmith link (src/config/langsmithThread.js) — and,
// once offered, is OFF until that person switches it on. Production builds
// never offer it, whoever is signed in.
//
// The pure rules live here without `import.meta.env` so they can be tested
// under Node; the hook (src/hooks/useMotionMeshDeveloperOverlay.js) supplies
// `isDev` and `isAdmin` at the call site.

const STORAGE_KEY = 'motion_mesh_developer_overlay';
const listeners = new Set();

/**
 * @param {unknown} [storage]
 * @returns {Storage|null}
 */
function storageOf(storage) {
  if (storage === undefined) return globalThis.localStorage ?? null;
  return storage ?? null;
}

/**
 * Whether the developer option should be offered at all.
 *
 * @param {Object} conditions
 * @param {boolean} [conditions.isDev] `import.meta.env.DEV` at the call site.
 * @param {boolean} [conditions.isAdmin] The signed-in account is the administrator.
 * @returns {boolean}
 */
export function shouldOfferMotionMeshDeveloperOption({
  isDev = false,
  isAdmin = false,
} = {}) {
  return Boolean(isDev && isAdmin);
}

/**
 * Whether this browser has the developer option switched on.
 *
 * Off until switched on. Reading this says nothing about whether the option
 * is offered: a stored `true` left behind by an administrator does nothing for
 * an account that is not, because `shouldDrawMotionMeshOverlay` checks both.
 *
 * @param {Storage|null|undefined} [storage]
 * @returns {boolean}
 */
export function readMotionMeshDeveloperOverlay(storage) {
  try {
    const raw = storageOf(storage)?.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return Boolean(parsed.shown);
    return Boolean(parsed);
  } catch {
    return false;
  }
}

/**
 * Switch the developer option on or off, and tell every listener.
 *
 * @param {boolean} shown
 * @param {Storage|null|undefined} [storage]
 * @returns {boolean} The state now in force.
 */
export function writeMotionMeshDeveloperOverlay(shown, storage) {
  const next = Boolean(shown);
  try {
    storageOf(storage)?.setItem(STORAGE_KEY, JSON.stringify({ shown: next }));
  } catch {
    // Private mode / quota: the choice then lasts only for this page.
  }
  for (const listener of listeners) listener(next);
  return next;
}

/**
 * @param {(shown: boolean) => void} listener Called after every write.
 * @returns {Function} Unsubscribe.
 */
export function subscribeMotionMeshDeveloperOverlay(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Whether the wireframe should actually be drawn over the camera tile.
 *
 * All of: the deployment has not switched the overlay off
 * (VITE_MOTION_WIREFRAME_OVERLAY), the option is offered to this person, and
 * this person has switched it on. Anything less and the tile shows the plain
 * camera.
 *
 * @param {Object} conditions
 * @param {boolean} [conditions.overlayEnabled] The deployment-level flag.
 * @param {boolean} [conditions.offered] `shouldOfferMotionMeshDeveloperOption(...)`.
 * @param {boolean} [conditions.shown] The stored developer switch.
 * @returns {boolean}
 */
export function shouldDrawMotionMeshOverlay({
  overlayEnabled = true,
  offered = false,
  shown = false,
} = {}) {
  return Boolean(overlayEnabled && offered && shown);
}
