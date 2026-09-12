/**
 * How the browser wireframes the person over a live webcam.
 *
 * The face is landmarked faster than the body because micro-expressions last
 * 40 to 200 milliseconds and gestures are slower; a window is flushed onto the
 * ambient observation the browser already sends, so no extra requests leave.
 */
const readNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const readFlag = (value, fallback) => {
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

export const MOTION_WIREFRAME_ENABLED = readFlag(
  import.meta.env?.VITE_MOTION_WIREFRAME_ENABLED,
  true
);
export const MOTION_WIREFRAME_OVERLAY = readFlag(
  import.meta.env?.VITE_MOTION_WIREFRAME_OVERLAY,
  true
);
/** Below this width the full 2,556-edge mesh is mud; draw the contours instead. */
export const MOTION_MESH_MIN_WIDTH_PX = readNumber(
  import.meta.env?.VITE_MOTION_MESH_MIN_WIDTH_PX,
  120
);
export const MOTION_FACE_FPS = readNumber(import.meta.env?.VITE_MOTION_FACE_FPS, 30);
export const MOTION_BODY_FPS = readNumber(import.meta.env?.VITE_MOTION_BODY_FPS, 15);
export const MOTION_TRACK_WINDOW_SECONDS = readNumber(
  import.meta.env?.VITE_MOTION_TRACK_WINDOW_SECONDS,
  10
);
/** Largest window sent as-is; a dense window past this is decimated first. */
export const MOTION_TRACK_MAX_BYTES = readNumber(
  import.meta.env?.VITE_MOTION_TRACK_MAX_BYTES,
  3_500_000
);
/**
 * Where the landmarker runtime comes from. The ES module bundle and its WASM
 * are loaded from the CDN at runtime rather than from node_modules: the
 * WASM has to come over the network anyway, and a package the dev container's
 * anonymous node_modules volume does not hold would fail the whole share
 * context at import time.
 */
export const MOTION_TASKS_VISION_MODULE_URL =
  import.meta.env?.VITE_MOTION_TASKS_VISION_MODULE_URL ??
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/vision_bundle.mjs';
export const MOTION_TASKS_VISION_WASM_URL =
  import.meta.env?.VITE_MOTION_TASKS_VISION_WASM_URL ??
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
export const MOTION_POSE_MODEL_URL =
  import.meta.env?.VITE_MOTION_POSE_MODEL_URL ??
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
export const MOTION_FACE_MODEL_URL =
  import.meta.env?.VITE_MOTION_FACE_MODEL_URL ??
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
