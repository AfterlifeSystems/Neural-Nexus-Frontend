// src/config/ambientCapture.js
//
// Ambient vision: while the webcam or the screen is shared, the browser sends
// one snapshot per source to the avatar on a fixed interval, as background
// context the avatar may ignore, respond to, or notify the person about.
//
// The interval is deployment configuration, not a per-user setting: set
// VITE_AMBIENT_CAPTURE_INTERVAL_SECONDS in the environment. The API enforces
// its own floor (AMBIENT_CAPTURE_MIN_INTERVAL_SECONDS) and answers 429 with a
// Retry-After header to a client that captures faster than that floor.

import { ambientCaptureIntervalMilliseconds } from './ambientCaptureInterval';

export {
  DEFAULT_AMBIENT_CAPTURE_INTERVAL_SECONDS,
  MINIMUM_AMBIENT_CAPTURE_INTERVAL_SECONDS,
  ambientCaptureIntervalMilliseconds,
} from './ambientCaptureInterval';

export const AMBIENT_CAPTURE_INTERVAL_MS = ambientCaptureIntervalMilliseconds(
  import.meta.env.VITE_AMBIENT_CAPTURE_INTERVAL_SECONDS
);
