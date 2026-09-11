// src/services/cameraFacing.js
//
// Front vs rear camera. A phone has both; a desktop almost never does.
// Constraints stay `ideal` so a machine with one camera still opens it
// instead of throwing OverconstrainedError.

export const CAMERA_FACING_REAR = 'environment';
export const CAMERA_FACING_FRONT = 'user';

/**
 * Phone, tablet, or a narrow layout — the places a second camera exists
 * and a flip control is worth showing.
 */
export const MOBILE_CAMERA_VIEW_QUERY =
  '(pointer: coarse), (max-width: 640px)';

/**
 * @param {string} [facingMode]
 * @returns {'user'|'environment'}
 */
export function oppositeCameraFacing(facingMode) {
  return facingMode === CAMERA_FACING_FRONT
    ? CAMERA_FACING_REAR
    : CAMERA_FACING_FRONT;
}

/**
 * @param {string} [facingMode]
 * @returns {{facingMode: {ideal: 'user'|'environment'}}}
 */
export function videoConstraintsForFacing(facingMode) {
  const facing =
    facingMode === CAMERA_FACING_FRONT
      ? CAMERA_FACING_FRONT
      : CAMERA_FACING_REAR;
  return { facingMode: { ideal: facing } };
}

/**
 * Read the facing the browser actually opened, defaulting to the front
 * camera when the track does not say (typical of `{ video: true }`).
 *
 * @param {MediaTrackSettings|null|undefined} settings
 * @returns {'user'|'environment'}
 */
export function facingFromTrackSettings(settings) {
  return settings?.facingMode === CAMERA_FACING_REAR
    ? CAMERA_FACING_REAR
    : CAMERA_FACING_FRONT;
}

/**
 * @param {string} [facingMode] The camera that is live now.
 * @returns {string}
 */
export function describeCameraFlip(facingMode) {
  return facingMode === CAMERA_FACING_FRONT
    ? 'Switch to the rear camera'
    : 'Switch to the front camera';
}

/**
 * @param {(query: string) => {matches: boolean}|undefined|null} [matchMedia]
 * @returns {boolean}
 */
export function isMobileCameraView(matchMedia = globalThis.matchMedia) {
  if (typeof matchMedia !== 'function') return false;
  return Boolean(matchMedia(MOBILE_CAMERA_VIEW_QUERY)?.matches);
}

/**
 * @param {string} [facingMode]
 * @returns {Promise<MediaStream>}
 */
export async function openCameraStream(facingMode) {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.mediaDevices?.getUserMedia !== 'function'
  ) {
    throw new Error('This browser cannot open the camera.');
  }
  return navigator.mediaDevices.getUserMedia({
    video: videoConstraintsForFacing(facingMode),
    audio: false,
  });
}
