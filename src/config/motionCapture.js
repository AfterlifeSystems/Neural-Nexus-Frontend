// src/config/motionCapture.js
//
// Whether this browser may learn how the person moves from the webcam.
//
// The landmarker (src/hooks/useMotionWireframe.js) reads the live camera,
// turns the person into 33 body joints and a 478-point face mesh, and sends
// windows of that to the API as motion tracks. That is a recording of a body,
// and it is OFF until the person turns it on: a camera opened to talk to an
// avatar is not consent to being measured.
//
// The switch is per browser, like the camera permission the avatar holds
// (`avatarShareControl.js`), and for the same reason: it governs THIS device's
// camera, and switching it on at a desk must not arm a phone the person never
// thought about. The same switch is shown in account settings and in the
// personal avatar's settings; both write here, so the two never disagree.
//
// Nothing about the camera is decided here. `MediaShareContext` reads this
// switch and starts or stops the landmarker; this module only remembers the
// choice and tells listeners.

const STORAGE_KEY = 'motion_capture';
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
 * Whether motion capture is switched on in this browser.
 *
 * Off until the person turns it on.
 *
 * @param {Storage|null|undefined} [storage]
 * @returns {boolean}
 */
export function readMotionCapture(storage) {
  try {
    const raw = storageOf(storage)?.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return Boolean(parsed.enabled);
    return Boolean(parsed);
  } catch {
    return false;
  }
}

/**
 * Switch motion capture on or off, and tell every listener.
 *
 * @param {boolean} enabled
 * @param {Storage|null|undefined} [storage]
 * @returns {boolean} The state now in force.
 */
export function writeMotionCapture(enabled, storage) {
  const next = Boolean(enabled);
  try {
    storageOf(storage)?.setItem(STORAGE_KEY, JSON.stringify({ enabled: next }));
  } catch {
    // Private mode / quota: the choice then lasts only for this page.
  }
  for (const listener of listeners) listener(next);
  return next;
}

/**
 * @param {(enabled: boolean) => void} listener Called after every write.
 * @returns {Function} Unsubscribe.
 */
export function subscribeMotionCapture(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Whether the landmarker should run right now.
 *
 * Every condition the landmarker already had, plus the person's switch. Kept
 * as one pure function so the rule can be read — and tested — in one place
 * rather than reassembled from the context's booleans.
 *
 * @param {Object} conditions
 * @param {boolean} conditions.captureEnabled The person's switch.
 * @param {boolean} conditions.ambientAllowed This account may run ambient vision.
 * @param {boolean} conditions.ambientCaptureAllowed This location may send an observation.
 * @param {boolean} conditions.hasAvatar An avatar is open to learn for.
 * @param {boolean} conditions.cameraFacesPerson The camera is the front one.
 * @returns {boolean}
 */
export function shouldRunMotionCapture({
  captureEnabled = false,
  ambientAllowed = false,
  ambientCaptureAllowed = false,
  hasAvatar = false,
  cameraFacesPerson = false,
} = {}) {
  return Boolean(
    captureEnabled &&
      ambientAllowed &&
      ambientCaptureAllowed &&
      hasAvatar &&
      cameraFacesPerson
  );
}
