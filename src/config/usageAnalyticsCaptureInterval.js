// src/config/usageAnalyticsCaptureInterval.js
//
// The pure half of src/config/usageAnalyticsCapture.js: how the environment's
// VITE_USAGE_ANALYTICS_CAPTURE_INTERVAL_SECONDS setting becomes milliseconds.
// Kept separate so the Node test runner can load the module without Vite's
// import.meta.env.

export const DEFAULT_USAGE_ANALYTICS_CAPTURE_INTERVAL_SECONDS = 30;

/** The shortest interval the browser will ever use, whatever the setting says. */
export const MINIMUM_USAGE_ANALYTICS_CAPTURE_INTERVAL_SECONDS = 10;

/**
 * Turn the environment's interval setting into milliseconds.
 *
 * A missing, empty, non-numeric, or too-small value falls back to the default
 * or the floor, so a mistyped setting slows capture down rather than turning
 * the feature into a flood of vision calls.
 *
 * @param {string|number|undefined|null} rawValue What the environment holds.
 * @returns {number} Milliseconds between captures.
 */
export function usageAnalyticsCaptureIntervalMilliseconds(rawValue) {
  const parsed = Number.parseFloat(String(rawValue ?? '').trim());
  const seconds =
    Number.isFinite(parsed) && parsed > 0
      ? Math.max(parsed, MINIMUM_USAGE_ANALYTICS_CAPTURE_INTERVAL_SECONDS)
      : DEFAULT_USAGE_ANALYTICS_CAPTURE_INTERVAL_SECONDS;
  return Math.round(seconds * 1000);
}
