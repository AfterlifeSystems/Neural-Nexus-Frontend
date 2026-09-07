// src/config/geoCheckinInterval.js
//
// The pure half of geoWatch.js, kept free of import.meta.env so the Node test
// runner can import it. Mirrors config/ambientCaptureInterval.js.

export const DEFAULT_GEO_CHECKIN_INTERVAL_SECONDS = 60;
export const MINIMUM_GEO_CHECKIN_INTERVAL_SECONDS = 10;

/**
 * The check-in interval in milliseconds, from a configured number of seconds.
 *
 * An unset, unparsable, or too-small value falls back to the default rather
 * than letting a typo turn the watcher into a request flood.
 *
 * @param {string|number|undefined} configuredSeconds
 * @returns {number} Milliseconds between two check-ins.
 */
export function geoCheckinIntervalMilliseconds(configuredSeconds) {
  const seconds = Number(configuredSeconds);
  if (!Number.isFinite(seconds) || seconds < MINIMUM_GEO_CHECKIN_INTERVAL_SECONDS) {
    return DEFAULT_GEO_CHECKIN_INTERVAL_SECONDS * 1000;
  }
  return Math.round(seconds * 1000);
}
