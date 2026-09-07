// src/config/usageAnalyticsCapture.js
//
// Usage analytics: while an account that opted in is signed in, the browser
// records every action taken in the application and captures the page itself
// (the document rendered to a canvas, never a window picker) once per
// interval while the tab is visible, and once after each route change.
//
// The interval is deployment configuration, not a per-user setting: set
// VITE_USAGE_ANALYTICS_CAPTURE_INTERVAL_SECONDS in the environment. The API
// enforces its own floor (USAGE_ANALYTICS_CAPTURE_MIN_INTERVAL_SECONDS) and
// answers 429 with a Retry-After header to a client that captures faster.

import { usageAnalyticsCaptureIntervalMilliseconds } from './usageAnalyticsCaptureInterval';

export {
  DEFAULT_USAGE_ANALYTICS_CAPTURE_INTERVAL_SECONDS,
  MINIMUM_USAGE_ANALYTICS_CAPTURE_INTERVAL_SECONDS,
  usageAnalyticsCaptureIntervalMilliseconds,
} from './usageAnalyticsCaptureInterval';

export const USAGE_ANALYTICS_CAPTURE_INTERVAL_MS =
  usageAnalyticsCaptureIntervalMilliseconds(
    import.meta.env.VITE_USAGE_ANALYTICS_CAPTURE_INTERVAL_SECONDS
  );
