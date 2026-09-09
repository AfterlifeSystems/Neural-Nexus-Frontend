// src/context/GeoAvatarContext.jsx
//
// One position watch per signed-in (or shared-link) frame, shared by everything
// that cares where the person is standing: the sidebar's local map, the notice
// that says an avatar is here, and the message request that tells the avatar
// its visitor has arrived.
//
// The watch is off until the person turns it on. Nothing here decides who may
// talk to whom — anyone may talk to a geo-located avatar from anywhere. Being
// at the place only changes how the avatar greets you and puts the live camera
// behind them.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useGeoAvatarWatcher } from '../hooks/useGeoAvatarWatcher';
import {
  canLocateDevice,
  describeLocationError,
  readGeoWatchPreference,
  writeGeoWatchPreference,
} from '../services/deviceLocation';
import {
  notifyDesktopIfHidden,
  requestDesktopNotificationPermission,
} from '../services/desktopNotifications';
import { showNearbyAvatarToast } from '../components/geo/showNearbyAvatarToast';
import { setStandingAtPlaces } from '../services/standingAtPlaces';

const GeoAvatarContext = createContext(null);

const WATCH_UNAVAILABLE = {
  canWatch: false,
  isWatchEnabled: false,
  setWatchEnabled: () => {},
  nearbyAvatars: [],
  position: null,
  locationErrorMessage: '',
  refreshPosition: () => {},
  isStandingAt: () => false,
  asAnonymousIdentity: false,
};

/**
 * @param {Object} props
 * @param {boolean} [props.asAnonymousIdentity] Call the API without the stored credential.
 * @param {(entry: Object) => void} props.onTalkNow Open an avatar over the live camera.
 * @param {React.ReactNode} props.children
 */
export function GeoAvatarProvider({ asAnonymousIdentity = false, onTalkNow, children }) {
  const [isWatchEnabled, setIsWatchEnabled] = useState(() => readGeoWatchPreference());

  const setWatchEnabled = useCallback((enabled) => {
    setIsWatchEnabled(enabled);
    writeGeoWatchPreference(enabled);
  }, []);

  // Ask for permission to show a desktop notification only once the person has
  // asked to be told about avatars nearby.
  useEffect(() => {
    if (!isWatchEnabled) return;
    requestDesktopNotificationPermission();
  }, [isWatchEnabled]);

  const handleEnterGeofence = useCallback(
    (entry) => {
      const placeName = entry.geo_location?.location_name;
      // The desktop notification fires only while the person is looking
      // somewhere else; the toast is the notice they see in the application.
      notifyDesktopIfHidden({
        title: `${entry.name ?? 'An avatar'} is here`,
        body: placeName
          ? `You have reached ${placeName}. Open the app to talk.`
          : 'You have reached this avatar’s place. Open the app to talk.',
        tag: `neural-nexus-geo:${entry.assistant_id}`,
      });
      showNearbyAvatarToast({ entry, onTalkNow });
    },
    [onTalkNow]
  );

  const { nearbyAvatars, position, error, refresh } = useGeoAvatarWatcher({
    enabled: isWatchEnabled,
    asAnonymousIdentity,
    onEnterGeofence: handleEnterGeofence,
  });

  // Published for the conversation store, which builds every message request
  // from above the router and cannot read this context.
  useEffect(() => {
    setStandingAtPlaces(
      nearbyAvatars
        .filter((entry) => entry.inside_geofence)
        .map((entry) => entry.assistant_id)
    );
  }, [nearbyAvatars]);

  const isStandingAt = useCallback(
    (assistantId) =>
      Boolean(
        assistantId &&
          nearbyAvatars.some(
            (entry) => entry.assistant_id === assistantId && entry.inside_geofence
          )
      ),
    [nearbyAvatars]
  );

  const value = useMemo(
    () => ({
      canWatch: canLocateDevice(),
      isWatchEnabled,
      setWatchEnabled,
      nearbyAvatars,
      position,
      locationErrorMessage: describeLocationError(error),
      refreshPosition: refresh,
      isStandingAt,
      // So a panel drawn from this watch can fetch an avatar's portrait as the
      // same identity the watch itself uses.
      asAnonymousIdentity,
    }),
    [
      isWatchEnabled,
      setWatchEnabled,
      nearbyAvatars,
      position,
      error,
      refresh,
      isStandingAt,
      asAnonymousIdentity,
    ]
  );

  return <GeoAvatarContext.Provider value={value}>{children}</GeoAvatarContext.Provider>;
}

/**
 * The shared position watch. Safe to call from a screen rendered outside the
 * provider: the watch then simply reports that it cannot run.
 *
 * @returns {Object}
 */
export function useGeoAvatars() {
  return useContext(GeoAvatarContext) ?? WATCH_UNAVAILABLE;
}

export default GeoAvatarContext;
