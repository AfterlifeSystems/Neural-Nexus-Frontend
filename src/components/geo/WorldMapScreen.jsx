// src/components/geo/WorldMapScreen.jsx
//
// The world map screen: every public avatar standing somewhere real, on a globe,
// and the place the person is standing right now.
//
// This is where someone comes to geo-locate, so locating happens here rather
// than only behind a switch in the sidebar. Turning it on here turns on the one
// shared position watch, so the sidebar map and the "an avatar is here" notice
// come alive at the same time.
//
// The globe is loaded on demand, because it carries its own copy of three.js
// that the rest of the application does not need.

import { Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, Crosshair, Loader2, MapPin } from 'lucide-react';

import { useGeoAvatars } from '../../context/GeoAvatarContext';
import { describeDistance } from '../../services/avatarProximity';
import { voiceChatPath } from '../../services/voiceModePreference';

const WorldAvatarGlobe = lazy(() => import('./WorldAvatarGlobe'));

const WorldMapScreen = () => {
  const navigate = useNavigate();
  const {
    canWatch,
    isWatchEnabled,
    setWatchEnabled,
    nearbyAvatars,
    position,
    locationErrorMessage,
    refreshPosition,
  } = useGeoAvatars();

  const openAvatar = (assistantId) =>
    navigate(voiceChatPath(assistantId, { cameraBackground: true }));

  const isLocating = isWatchEnabled && !position && !locationErrorMessage;

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-3 p-4">
      <header>
        <h1 className="text-lg font-semibold text-neutral-100">
          Avatars in the world
        </h1>
        <p className="text-sm text-white/50">
          Every shared avatar that stands at a real place — a memorial, a
          marker, a monument, a storefront. Spin the globe and come closer to
          see the places separate; walk up to one and it will greet you where
          you stand.
        </p>
      </header>

      {/* Locating lives here, on the screen someone opens to find avatars near
          them, rather than only behind a switch in the sidebar. */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/60 px-4 py-3 backdrop-blur-lg">
        {canWatch ? (
          <>
            <button
              type="button"
              onClick={() =>
                isWatchEnabled ? refreshPosition() : setWatchEnabled(true)
              }
              className="inline-flex items-center gap-2 rounded-md border border-amber-300/40 px-3 py-1.5 text-sm text-amber-200 transition-colors hover:bg-amber-300/10 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
            >
              {isLocating ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Crosshair className="h-4 w-4" aria-hidden="true" />
              )}
              {isWatchEnabled ? 'Update my position' : 'Find avatars near me'}
            </button>

            {isWatchEnabled && (
              <label className="inline-flex items-center gap-2 text-xs text-white/60">
                <input
                  type="checkbox"
                  checked={isWatchEnabled}
                  onChange={(changeEvent) =>
                    setWatchEnabled(changeEvent.target.checked)
                  }
                  className="h-3.5 w-3.5 accent-amber-400"
                />
                Keep watching and notify me when I reach a place
              </label>
            )}

            {position && (
              <span className="inline-flex items-center gap-1.5 text-xs text-white/50">
                <Compass className="h-3.5 w-3.5" aria-hidden="true" />
                {position.latitude.toFixed(4)}, {position.longitude.toFixed(4)}
                {position.accuracyMeters
                  ? ` · ±${describeDistance(position.accuracyMeters)}`
                  : ''}
              </span>
            )}

            {isWatchEnabled && !locationErrorMessage && (
              <span className="text-xs text-white/50">
                {nearbyAvatars.length === 0
                  ? position
                    ? 'No avatars stand near you yet.'
                    : 'Waiting for this device to say where it is…'
                  : `${nearbyAvatars.length} near you`}
              </span>
            )}
          </>
        ) : (
          <p className="text-xs text-white/50">
            This browser will not say where the device is, so avatars near you
            cannot be found. Location needs a secure (https) connection.
          </p>
        )}

        {locationErrorMessage && (
          <p className="text-xs text-red-300">{locationErrorMessage}</p>
        )}
      </div>

      {nearbyAvatars.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {nearbyAvatars.map((entry) => (
            <li key={entry.assistant_id}>
              <button
                type="button"
                onClick={() => openAvatar(entry.assistant_id)}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-xs text-neutral-200 backdrop-blur-lg transition-colors hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              >
                <MapPin
                  className={`h-3.5 w-3.5 ${
                    entry.inside_geofence ? 'text-amber-300' : 'text-white/40'
                  }`}
                  aria-hidden="true"
                />
                <span className="max-w-[12rem] truncate">{entry.name}</span>
                <span className="text-white/40">
                  {entry.inside_geofence
                    ? 'you are here'
                    : describeDistance(entry.distance_meters)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="min-h-0 flex-1">
        <Suspense
          fallback={
            <div className="flex h-full w-full items-center justify-center rounded-xl border border-white/10 bg-black/60 backdrop-blur-lg">
              <span className="inline-flex items-center gap-2 text-sm text-white/50">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Building the globe…
              </span>
            </div>
          }
        >
          <WorldAvatarGlobe
            devicePosition={position}
            onOpenAvatar={(avatar) => openAvatar(avatar.assistant_id)}
          />
        </Suspense>
      </div>
    </div>
  );
};

export default WorldMapScreen;
