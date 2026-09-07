// src/components/geo/NearbyAvatarsMapPanel.jsx
//
// The local map: a street map of the geo-located avatars standing around the
// person right now, with the list beneath it. This is the sidebar's answer to
// "who is near me", as distinct from the world globe's "where is everyone".
//
// The panel draws whatever the watcher has already found, so it never starts a
// second position watch of its own.

import { Fragment, useMemo } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import { Compass, MapPin, RefreshCw } from 'lucide-react';

import { MAP_TILE_ATTRIBUTION, MAP_TILE_URL } from '../../config/maps';
import { describeDistance } from '../../services/avatarProximity';
import { avatarPinIcon, devicePositionIcon } from './avatarPinMarker';
import 'leaflet/dist/leaflet.css';
import './leafletMapStyles.css';

/**
 * @param {Object} props
 * @param {Array} props.nearbyAvatars Entries from the watcher: {assistant_id, name, geo_location, distance_meters, inside_geofence}.
 * @param {Object|null} props.position Where the device is: {latitude, longitude, accuracyMeters}.
 * @param {string} props.error A sentence to show when locating failed.
 * @param {boolean} props.enabled Whether the person has the watch turned on.
 * @param {() => void} props.onRefresh Read the position again now.
 * @param {(entry: Object) => void} props.onOpenAvatar Open one avatar.
 */
const NearbyAvatarsMapPanel = ({
  nearbyAvatars = [],
  position,
  error,
  enabled,
  onRefresh,
  onOpenAvatar,
}) => {
  const center = useMemo(
    () => (position ? [position.latitude, position.longitude] : null),
    [position]
  );

  if (!enabled) {
    return (
      <p className="px-1 text-xs text-white/50">
        Turn on the nearby-avatar watch to see the avatars standing around you.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {center ? (
        <div className="h-44 w-full overflow-hidden rounded-lg border border-white/10">
          <MapContainer
            center={center}
            zoom={16}
            scrollWheelZoom={false}
            className="neural-nexus-map h-full w-full"
          >
            <TileLayer url={MAP_TILE_URL} attribution={MAP_TILE_ATTRIBUTION} />
            <Marker position={center} icon={devicePositionIcon} />
            {nearbyAvatars.map((entry) => {
              const pin = entry.geo_location;
              if (!pin) return null;
              return (
                <Fragment key={entry.assistant_id}>
                  <Circle
                    center={[pin.latitude, pin.longitude]}
                    radius={pin.geofence_radius_meters ?? 50}
                    pathOptions={{
                      color: entry.inside_geofence ? '#fbbf24' : '#a3a3a3',
                      weight: 1,
                      fillOpacity: entry.inside_geofence ? 0.18 : 0.08,
                    }}
                  />
                  <Marker
                    position={[pin.latitude, pin.longitude]}
                    icon={avatarPinIcon}
                    eventHandlers={{ click: () => onOpenAvatar?.(entry) }}
                  >
                    <Popup>
                      <span className="font-medium">{entry.name}</span>
                      {pin.location_name ? <> — {pin.location_name}</> : null}
                    </Popup>
                  </Marker>
                </Fragment>
              );
            })}
          </MapContainer>
        </div>
      ) : (
        <p className="px-1 text-xs text-white/50">
          Waiting for this device to say where it is…
        </p>
      )}

      {error && <p className="px-1 text-xs text-red-300">{error}</p>}

      <ul className="space-y-1">
        {nearbyAvatars.map((entry) => (
          <li key={entry.assistant_id}>
            <button
              type="button"
              onClick={() => onOpenAvatar?.(entry)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-neutral-200 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
            >
              <MapPin
                className={`h-3.5 w-3.5 shrink-0 ${
                  entry.inside_geofence ? 'text-amber-300' : 'text-white/40'
                }`}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate">
                {entry.name}
                {entry.geo_location?.location_name ? (
                  <span className="text-white/40">
                    {' '}
                    · {entry.geo_location.location_name}
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 text-white/40">
                {entry.inside_geofence
                  ? 'you are here'
                  : describeDistance(entry.distance_meters)}
              </span>
            </button>
          </li>
        ))}
        {nearbyAvatars.length === 0 && position && (
          <li className="px-2 py-1.5 text-xs text-white/40">
            No avatars stand near you yet.
          </li>
        )}
      </ul>

      <div className="flex items-center gap-2 px-1">
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Refresh my position
        </button>
        {position?.accuracyMeters ? (
          <span className="inline-flex items-center gap-1 text-xs text-white/30">
            <Compass className="h-3 w-3" aria-hidden="true" />
            ±{describeDistance(position.accuracyMeters)}
          </span>
        ) : null}
      </div>
    </div>
  );
};

export default NearbyAvatarsMapPanel;
