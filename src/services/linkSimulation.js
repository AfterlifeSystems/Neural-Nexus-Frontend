// src/services/linkSimulation.js
//
// Attach the developer Neuralink demo to the always-on motion (:8101) and V1
// (:8102) servers. The demo writes through Neural Nexus: reconstructed JPEGs
// ride ambient `webcam.jpg`, and decoder windows ride
// POST /avatar_motion_tracks with source=neural_decoder. Nothing here occupies
// the share-rail webcam.

export const WEBCAM_JPEG_FILENAME = 'webcam.jpg';
export const NEURAL_DECODER_SOURCE = 'neural_decoder';
export const V1_CAMERA_FACING = 'environment';

/**
 * Latest mapped right-wrist XYZ from the motion server.
 *
 * @param {string} motionServerUrl
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<{x: number, y: number, z: number, path: string}|null>}
 */
export async function fetchMotionCurrent(motionServerUrl, fetchImpl = fetch) {
  const response = await fetchImpl(`${motionServerUrl}/simulations/motion/current`);
  if (!response.ok) {
    throw new Error(`Motion current returned ${response.status}`);
  }
  return response.json();
}

/**
 * Latest sparse neural_decoder window from the motion server.
 *
 * @param {string} motionServerUrl
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<object>}
 */
export async function fetchMotionCurrentWindow(motionServerUrl, fetchImpl = fetch) {
  const response = await fetchImpl(
    `${motionServerUrl}/simulations/motion/current_window`
  );
  if (!response.ok) {
    throw new Error(`Motion current_window returned ${response.status}`);
  }
  return response.json();
}

/**
 * Latest reconstructed JPEG from the V1 server.
 *
 * @param {string} v1ServerUrl
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<Blob>}
 */
export async function fetchV1Jpeg(v1ServerUrl, fetchImpl = fetch) {
  const response = await fetchImpl(`${v1ServerUrl}/simulations/v1/current.jpg`, {
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`V1 current.jpg returned ${response.status}`);
  }
  return response.blob();
}

/**
 * V1 fixture-vs-live status.
 *
 * @param {string} v1ServerUrl
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<{path: string, frame_index: number, frame_count: number}>}
 */
export async function fetchV1Status(v1ServerUrl, fetchImpl = fetch) {
  const response = await fetchImpl(`${v1ServerUrl}/simulations/v1/status`);
  if (!response.ok) {
    throw new Error(`V1 status returned ${response.status}`);
  }
  return response.json();
}

/**
 * Turn a reconstructed JPEG blob into the ambient still filename Anubis already
 * treats as a webcam snapshot. No new ambient source name.
 *
 * @param {Blob} jpegBlob
 * @returns {File}
 */
export function webcamJpegFileFromBlob(jpegBlob) {
  return new File([jpegBlob], WEBCAM_JPEG_FILENAME, { type: 'image/jpeg' });
}

/**
 * A trail point from the motion server's current XYZ snapshot.
 *
 * @param {object|null|undefined} snapshot
 * @returns {{x: number, y: number, z: number}|null}
 */
export function trailPointFromCurrent(snapshot) {
  const x = Number(snapshot?.x);
  const y = Number(snapshot?.y);
  const z = Number(snapshot?.z);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y, z: Number.isFinite(z) ? z : 0 };
}

/**
 * Keep the last N trail points for the demo-panel wrist path.
 *
 * @param {Array<{x: number, y: number, z: number}>} points
 * @param {{x: number, y: number, z: number}|null} nextPoint
 * @param {number} [limit]
 * @returns {Array<{x: number, y: number, z: number}>}
 */
export function appendTrailPoint(points, nextPoint, limit = 48) {
  if (!nextPoint) return points;
  return [...points, nextPoint].slice(-limit);
}
