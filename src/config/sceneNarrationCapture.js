// src/config/sceneNarrationCapture.js
//
// The environment's scene-narration pacing, read once. Set
// VITE_SCENE_NARRATION_INTERVAL_SECONDS (default 5, floor 3 — the API's own
// narration minimum) and VITE_SCENE_NARRATION_HEARTBEAT_SECONDS (default 45;
// 0 for none).

import {
  sceneNarrationHeartbeatMilliseconds,
  sceneNarrationIntervalMilliseconds,
} from './sceneNarrationInterval';

export {
  DEFAULT_SCENE_NARRATION_HEARTBEAT_SECONDS,
  DEFAULT_SCENE_NARRATION_INTERVAL_SECONDS,
  MINIMUM_SCENE_NARRATION_INTERVAL_SECONDS,
} from './sceneNarrationInterval';

/** How often the camera is described while narration is on. */
export const SCENE_NARRATION_INTERVAL_MS = sceneNarrationIntervalMilliseconds(
  import.meta.env.VITE_SCENE_NARRATION_INTERVAL_SECONDS
);

/** How long an unchanging scene may go undescribed before it is described again. */
export const SCENE_NARRATION_HEARTBEAT_MS = sceneNarrationHeartbeatMilliseconds(
  import.meta.env.VITE_SCENE_NARRATION_HEARTBEAT_SECONDS
);
