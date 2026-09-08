// src/components/geo/AvatarLocationPicker.jsx
//
// Choose the real-world place an avatar stands at. Used both when an avatar is
// created and later from Avatar Settings, because a memorial or a marker is
// often placed long after the avatar itself was made.
//
// The map is the primary control — drag the marker, or click the map — with the
// coordinates shown as editable text for anyone who has them written down. The
// circle is the geofence: the distance within which a passer-by counts as
// having arrived.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { Crosshair, Loader2, MapPin, Trash2 } from 'lucide-react';

import { MAP_TILE_ATTRIBUTION, MAP_TILE_URL } from '../../config/maps';
import {
  DEFAULT_GEOFENCE_RADIUS_METERS,
  MAXIMUM_GEOFENCE_RADIUS_METERS,
  METERS_PER_MILE,
  MINIMUM_GEOFENCE_RADIUS_METERS,
  clampGeofenceRadius,
  describeGeofenceRadius,
  formatCoordinate,
  isValidCoordinate,
  milesFromMeters,
} from '../../services/avatarProximity';
import { describeLocationError, readDevicePositionOnce } from '../../services/deviceLocation';
import { draftPinIcon } from './avatarPinMarker';
import 'leaflet/dist/leaflet.css';
import './leafletMapStyles.css';

// Somewhere recognisable to start from when the browser will not say where the
// device is: the middle of the contiguous United States.
const FALLBACK_CENTER = { latitude: 39.5, longitude: -98.35 };

function RecenterMapOn({ latitude, longitude }) {
  const map = useMap();
  useEffect(() => {
    if (!isValidCoordinate(latitude, longitude)) return;
    map.setView([latitude, longitude], map.getZoom(), { animate: true });
  }, [latitude, longitude, map]);
  return null;
}

function ClickToPlacePin({ onPlace }) {
  useMapEvents({
    click: (mapEvent) => {
      onPlace(mapEvent.latlng.lat, mapEvent.latlng.lng);
    },
  });
  return null;
}

/**
 * @param {Object} props
 * @param {Object|null} props.value The pin being edited: {latitude, longitude, locationName, geofenceRadiusMeters}.
 * @param {(value: Object) => void} props.onChange Called with the whole pin whenever any part changes.
 * @param {string} [props.heightClassName] Tailwind height for the map.
 */
const AvatarLocationPicker = ({ value, onChange, heightClassName = 'h-56' }) => {
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [radiusUnit, setRadiusUnit] = useState('m');

  const latitude = value?.latitude;
  const longitude = value?.longitude;
  const hasPin = isValidCoordinate(latitude, longitude);
  const radiusMeters = clampGeofenceRadius(
    value?.geofenceRadiusMeters ?? DEFAULT_GEOFENCE_RADIUS_METERS
  );

  const center = useMemo(
    () =>
      hasPin
        ? [latitude, longitude]
        : [FALLBACK_CENTER.latitude, FALLBACK_CENTER.longitude],
    [hasPin, latitude, longitude]
  );

  const placePin = useCallback(
    (nextLatitude, nextLongitude) => {
      onChange({
        ...value,
        latitude: Number(nextLatitude.toFixed(6)),
        longitude: Number(nextLongitude.toFixed(6)),
      });
    },
    [onChange, value]
  );

  const useMyPosition = useCallback(async () => {
    setIsLocating(true);
    setLocationError('');
    try {
      const position = await readDevicePositionOnce();
      placePin(position.coords.latitude, position.coords.longitude);
    } catch (error) {
      setLocationError(describeLocationError(error));
    } finally {
      setIsLocating(false);
    }
  }, [placePin]);

  return (
    <div className="space-y-3">
      <div
        className={`${heightClassName} w-full overflow-hidden rounded-lg border border-white/10`}
      >
        <MapContainer
          center={center}
          zoom={hasPin ? 18 : 3}
          minZoom={2}
          maxZoom={19}
          scrollWheelZoom
          className="neural-nexus-map h-full w-full"
        >
          <TileLayer url={MAP_TILE_URL} attribution={MAP_TILE_ATTRIBUTION} />
          <ClickToPlacePin onPlace={placePin} />
          <RecenterMapOn latitude={latitude} longitude={longitude} />
          {hasPin && (
            <>
              <Circle
                center={[latitude, longitude]}
                radius={radiusMeters}
                pathOptions={{ color: '#fbbf24', weight: 1, fillOpacity: 0.12 }}
              />
              <Marker
                position={[latitude, longitude]}
                icon={draftPinIcon}
                draggable
                eventHandlers={{
                  dragend: (dragEvent) => {
                    const moved = dragEvent.target.getLatLng();
                    placePin(moved.lat, moved.lng);
                  },
                }}
              />
            </>
          )}
        </MapContainer>
      </div>

      <p className="text-xs text-white/50">
        Click the map or drag the marker to place this avatar. The circle is how
        close someone must be to count as standing here.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={useMyPosition}
          disabled={isLocating}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-neutral-200 hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:opacity-60"
        >
          {isLocating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Crosshair className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Use my position
        </button>
        {hasPin && (
          <>
            <span className="inline-flex items-center gap-1.5 text-xs text-white/50">
              <MapPin className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
              {formatCoordinate(latitude)}, {formatCoordinate(longitude)}
            </span>
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...value,
                  latitude: undefined,
                  longitude: undefined,
                })
              }
              className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white/60 hover:bg-black/60 hover:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Clear the pin
            </button>
          </>
        )}
      </div>

      {locationError && <p className="text-xs text-red-300">{locationError}</p>}

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-white/60">
          Latitude
          <input
            type="text"
            inputMode="decimal"
            value={latitude ?? ''}
            onChange={(changeEvent) =>
              onChange({ ...value, latitude: Number(changeEvent.target.value) })
            }
            className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-neutral-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
          />
        </label>
        <label className="text-xs text-white/60">
          Longitude
          <input
            type="text"
            inputMode="decimal"
            value={longitude ?? ''}
            onChange={(changeEvent) =>
              onChange({ ...value, longitude: Number(changeEvent.target.value) })
            }
            className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-neutral-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
          />
        </label>
      </div>

      <label className="block text-xs text-white/60">
        Place name
        <input
          type="text"
          value={value?.locationName ?? ''}
          onChange={(changeEvent) =>
            onChange({ ...value, locationName: changeEvent.target.value })
          }
          placeholder="Stone Arch Bridge"
          className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-neutral-200 placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
        />
        <span className="mt-1 block text-white/40">
          The avatar calls the place by this name and never reads out coordinates.
        </span>
      </label>

      <label className="block text-xs text-white/60">
        Visitors count as here within {describeGeofenceRadius(radiusMeters)}
        <span className="mt-1 block text-white/40">
          Type metres or miles. One metre is a doorway; one mile is kept as
          {` ${Math.round(METERS_PER_MILE)} m`}, never shown as 0 m.
        </span>
        <div className="mt-1 flex gap-1">
          <button
            type="button"
            onClick={() => setRadiusUnit('m')}
            className={`rounded-md border px-2 py-1 text-xs ${
              radiusUnit === 'm'
                ? 'border-white/20 bg-white/10 text-neutral-100'
                : 'border-white/10 text-white/50'
            }`}
          >
            meters
          </button>
          <button
            type="button"
            onClick={() => setRadiusUnit('mi')}
            className={`rounded-md border px-2 py-1 text-xs ${
              radiusUnit === 'mi'
                ? 'border-white/20 bg-white/10 text-neutral-100'
                : 'border-white/10 text-white/50'
            }`}
          >
            miles
          </button>
        </div>
        <input
          type="number"
          min={radiusUnit === 'mi' ? 0.001 : MINIMUM_GEOFENCE_RADIUS_METERS}
          max={
            radiusUnit === 'mi'
              ? MAXIMUM_GEOFENCE_RADIUS_METERS / METERS_PER_MILE
              : MAXIMUM_GEOFENCE_RADIUS_METERS
          }
          step={radiusUnit === 'mi' ? 0.01 : 1}
          value={
            radiusUnit === 'mi'
              ? milesFromMeters(
                  value?.geofenceRadiusMeters ?? DEFAULT_GEOFENCE_RADIUS_METERS
                ).toFixed(2)
              : (value?.geofenceRadiusMeters ?? DEFAULT_GEOFENCE_RADIUS_METERS)
          }
          onChange={(changeEvent) => {
            const typed = Number(changeEvent.target.value);
            onChange({
              ...value,
              geofenceRadiusMeters:
                radiusUnit === 'mi' ? typed * METERS_PER_MILE : typed,
            });
          }}
          className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-neutral-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
        />
      </label>
    </div>
  );
};

export default AvatarLocationPicker;
