// src/services/deviceLocation.js
//
// One place for the browser's Geolocation API, mirroring displayCapture.js.
// Geolocation is missing on insecure origins and refused outright by some
// browsers, so every entry point here answers a capability question before a
// component decides to offer the feature at all.
//
// Note that a page served over plain HTTP from anything other than localhost
// gets no geolocation at all, silently: testing on a phone against the Vite dev
// server over a LAN address needs HTTPS or a tunnel.

export const GEO_WATCH_PREFERENCE_KEY = 'neural_nexus_geo_watch_enabled';

const POSITION_OPTIONS = {
  enableHighAccuracy: true,
  maximumAge: 30000,
  timeout: 20000,
};

/**
 * Whether this browser can report where the device is.
 *
 * @returns {boolean}
 */
export function canLocateDevice() {
  if (typeof navigator === 'undefined') return false;
  return typeof navigator.geolocation?.watchPosition === 'function';
}

/**
 * Whether the person previously turned the nearby-avatar watch on.
 *
 * @returns {boolean}
 */
export function readGeoWatchPreference() {
  try {
    return window.localStorage.getItem(GEO_WATCH_PREFERENCE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Remember whether the nearby-avatar watch is on.
 *
 * @param {boolean} enabled
 * @returns {void}
 */
export function writeGeoWatchPreference(enabled) {
  try {
    window.localStorage.setItem(GEO_WATCH_PREFERENCE_KEY, enabled ? 'true' : 'false');
  } catch {
    // A browser with site data blocked simply forgets the choice between
    // sessions; the watch still works for as long as this page is open.
  }
}

/**
 * Watch the device's position until the returned function is called.
 *
 * @param {(position: GeolocationPosition) => void} onPosition
 * @param {(error: GeolocationPositionError) => void} onError
 * @returns {() => void} Stops the watch.
 */
export function watchDevicePosition(onPosition, onError) {
  if (!canLocateDevice()) return () => {};
  const watchIdentifier = navigator.geolocation.watchPosition(
    onPosition,
    onError,
    POSITION_OPTIONS
  );
  return () => {
    try {
      navigator.geolocation.clearWatch(watchIdentifier);
    } catch {
      // Nothing to clear.
    }
  };
}

/**
 * Read the device's position once.
 *
 * @returns {Promise<GeolocationPosition>}
 */
export function readDevicePositionOnce() {
  return new Promise((resolve, reject) => {
    if (!canLocateDevice()) {
      const error = new Error('This browser cannot report where the device is.');
      error.name = 'NotSupportedError';
      reject(error);
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, POSITION_OPTIONS);
  });
}

/**
 * The sentence to show a person whose browser refused to locate the device.
 *
 * @param {GeolocationPositionError|Error|null} error
 * @returns {string}
 */
export function describeLocationError(error) {
  if (!error) return '';
  if (error.code === 1) {
    return 'Location access was refused. Allow it in your browser to find avatars near you.';
  }
  if (error.code === 2) {
    return 'This device could not work out where it is. Try again outdoors or with Wi-Fi on.';
  }
  if (error.code === 3) {
    return 'Locating this device took too long. Try again in a moment.';
  }
  return 'This browser cannot report where the device is.';
}
