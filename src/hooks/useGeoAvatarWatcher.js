// src/hooks/useGeoAvatarWatcher.js
//
// Watches where the device is while the person has the nearby-avatar watch
// turned on, reports the position to the API on a fixed floor, and calls back
// once when the person walks into a geo-located avatar's geofence.
//
// Three separate limits keep this quiet: the browser reports positions far more
// often than the API is called (the interval floor below), the API records at
// most one visit per person per avatar per window, and the API nominates an
// avatar for notification at most once per cooldown. This hook adds the fourth:
// a geofence already entered on this page does not fire the callback again
// until the person leaves the geofence and comes back.

import { useCallback, useEffect, useRef, useState } from 'react';

import { GEO_CHECKIN_INTERVAL_MS } from '../config/geoWatch';
import { geoCheckin, listNearbyAvatars } from '../services/avatarService';
import {
  cappedAccuracyMeters,
  refineNearbyAvatars,
} from '../services/avatarProximity';
import {
  canLocateDevice,
  readDevicePositionOnce,
  watchDevicePosition,
} from '../services/deviceLocation';

/**
 * @param {Object} options
 * @param {boolean} options.enabled Whether the person turned the watch on.
 * @param {boolean} [options.asAnonymousIdentity] Call the API without the stored credential.
 * @param {(entry: Object) => void} [options.onEnterGeofence] Called once when the person reaches an avatar's place.
 * @param {number} [options.checkinIntervalMs] Shortest gap between two API calls.
 * @returns {{nearbyAvatars: Array, position: Object|null, error: Object|null, refresh: () => void}}
 */
export function useGeoAvatarWatcher({
  enabled,
  asAnonymousIdentity = false,
  onEnterGeofence,
  checkinIntervalMs = GEO_CHECKIN_INTERVAL_MS,
}) {
  const [nearbyAvatars, setNearbyAvatars] = useState([]);
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);

  const lastCheckinAtRef = useRef(0);
  const enteredGeofencesRef = useRef(new Set());
  const onEnterGeofenceRef = useRef(onEnterGeofence);
  const isMountedRef = useRef(true);

  onEnterGeofenceRef.current = onEnterGeofence;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const reportPosition = useCallback(
    async (devicePosition) => {
      const { latitude, longitude, accuracy } = devicePosition.coords;
      // A kilometres-wide Wi-Fi fix must not widen a doorway geofence. Phone
      // GPS of a few metres is passed through; anything coarser is capped.
      const accuracyMeters = cappedAccuracyMeters(accuracy);
      const reading = { latitude, longitude, accuracyMeters: accuracy };
      let nearby = [];
      try {
        const checkin = await geoCheckin(
          { latitude, longitude, accuracyMeters },
          { asAnonymousIdentity }
        );
        nearby = checkin?.nearby ?? [];
        // A check-in that the API throttled still needs a list to draw, so fall
        // back to the plain nearby search.
        if (!checkin?.nearby) {
          nearby = await listNearbyAvatars(
            { latitude, longitude, accuracyMeters, radiusMeters: 1000 },
            { asAnonymousIdentity }
          );
        }
      } catch (checkinError) {
        if (isMountedRef.current) setError(checkinError);
        return;
      }
      if (!isMountedRef.current) return;
      nearby = refineNearbyAvatars(nearby, reading);
      setError(null);
      setNearbyAvatars(nearby);

      // Leaving a geofence re-arms the offer for the next visit. Arrival is
      // decided here, after the coarse-accuracy filter, so the live camera
      // only opens for someone who is actually at the place.
      const currentlyInside = new Set(
        nearby
          .filter((entry) => entry.inside_geofence)
          .map((entry) => entry.assistant_id)
      );
      for (const assistantId of [...enteredGeofencesRef.current]) {
        if (!currentlyInside.has(assistantId)) {
          enteredGeofencesRef.current.delete(assistantId);
        }
      }
      for (const entry of nearby) {
        if (!entry.inside_geofence) continue;
        if (enteredGeofencesRef.current.has(entry.assistant_id)) continue;
        enteredGeofencesRef.current.add(entry.assistant_id);
        onEnterGeofenceRef.current?.(entry);
      }
    },
    [asAnonymousIdentity]
  );

  const handlePosition = useCallback(
    (devicePosition) => {
      setPosition({
        latitude: devicePosition.coords.latitude,
        longitude: devicePosition.coords.longitude,
        accuracyMeters: devicePosition.coords.accuracy,
      });
      const now = Date.now();
      if (now - lastCheckinAtRef.current < checkinIntervalMs) return;
      lastCheckinAtRef.current = now;
      reportPosition(devicePosition);
    },
    [checkinIntervalMs, reportPosition]
  );

  useEffect(() => {
    if (!enabled) {
      // Stopping the watch also withdraws the last shared position from this
      // page: the ring on the globe, the nearby list, and any "you are here"
      // flags. The server keeps at most the last check-in; there is no delete
      // endpoint, so this is the client half of "remove my location".
      setNearbyAvatars([]);
      setPosition(null);
      setError(null);
      enteredGeofencesRef.current.clear();
      return undefined;
    }
    if (!canLocateDevice()) return undefined;
    // The first fix should reach the API without waiting out the interval.
    lastCheckinAtRef.current = 0;
    const enteredGeofences = enteredGeofencesRef.current;
    const stopWatching = watchDevicePosition(handlePosition, (watchError) => {
      if (isMountedRef.current) setError(watchError);
    });
    return () => {
      stopWatching();
      // Turning the watch off forgets which places were already reached, so
      // the offer is made again the next time the watch is turned on.
      enteredGeofences.clear();
    };
  }, [enabled, handlePosition]);

  const refresh = useCallback(async () => {
    try {
      const devicePosition = await readDevicePositionOnce();
      lastCheckinAtRef.current = 0;
      handlePosition(devicePosition);
    } catch (refreshError) {
      if (isMountedRef.current) setError(refreshError);
    }
  }, [handlePosition]);

  return { nearbyAvatars, position, error, refresh };
}

export default useGeoAvatarWatcher;
