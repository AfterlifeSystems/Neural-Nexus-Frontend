// src/components/geo/AvatarLocationPicker.jsx
//
// Choose the real-world place an avatar stands at. Used both when an avatar is
// created and later from Avatar Settings, because a memorial or a marker is
// often placed long after the avatar itself was made.
//
// The map is the primary control — drag the marker, or click the map — with a
// search box for a place name or a written-down coordinate pair, and the
// coordinates shown as editable text. The circle is the geofence: the distance
// within which a passer-by counts as having arrived.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { Crosshair, Loader2, MapPin, Search, Trash2 } from 'lucide-react';

import { GEOCODER_URL, MAP_TILE_ATTRIBUTION, MAP_TILE_URL } from '../../config/maps';
import {
  DEFAULT_GEOFENCE_RADIUS_METERS,
  clampGeofenceRadius,
  formatCoordinate,
  isValidCoordinate,
  pinCoordinate,
} from '../../services/avatarProximity';
import { describeLocationError, readDevicePositionOnce } from '../../services/deviceLocation';
import {
  describePlaceSearchError,
  isPartialDecimal,
  parseCoordinatePair,
  parseDecimal,
  searchPlaces,
} from '../../services/placeSearch';
import GeofenceRadiusField from './GeofenceRadiusField';
import { draftPinIcon } from './avatarPinMarker';
import 'leaflet/dist/leaflet.css';
import './leafletMapStyles.css';

// Somewhere recognisable to start from when the browser will not say where the
// device is: the middle of the contiguous United States.
const FALLBACK_CENTER = { latitude: 39.5, longitude: -98.35 };

// Close enough to see the doorway a searched-for place stands at.
const SEARCH_RESULT_ZOOM = 17;

function RecenterMapOn({ latitude, longitude }) {
  const map = useMap();
  useEffect(() => {
    if (!isValidCoordinate(latitude, longitude)) return;
    map.setView([latitude, longitude], map.getZoom(), { animate: true });
  }, [latitude, longitude, map]);
  return null;
}

// A search lands the map on the result at street level, however far out the
// map was before; clicks and marker drags keep whatever zoom the person chose.
function FlyToRequest({ request }) {
  const map = useMap();
  useEffect(() => {
    if (!request) return;
    if (!isValidCoordinate(request.latitude, request.longitude)) return;
    map.setView([request.latitude, request.longitude], request.zoom, { animate: true });
  }, [request, map]);
  return null;
}

/**
 * A coordinate field that holds what the person typed, so "-" and "44." stay
 * on screen instead of becoming NaN or losing the decimal point, and commits a
 * number only once the text is one.
 *
 * @param {number|undefined} committedValue The coordinate the pin holds.
 * @param {(value: number|undefined) => void} onCommit Called with the parsed number, or undefined when the field is emptied.
 */
function useCoordinateField(committedValue, onCommit) {
  const [text, setText] = useState(() =>
    committedValue === undefined || committedValue === null ? '' : String(committedValue)
  );
  const emittedRef = useRef(committedValue);

  // A click on the map or a search result changes the coordinate from outside
  // this field; mirror it. A value this field itself emitted is already shown.
  useEffect(() => {
    if (committedValue === emittedRef.current) return;
    emittedRef.current = committedValue;
    setText(
      committedValue === undefined || committedValue === null ? '' : String(committedValue)
    );
  }, [committedValue]);

  const onTextChange = useCallback(
    (nextText) => {
      if (!isPartialDecimal(nextText)) return;
      setText(nextText);
      if (nextText.trim() === '') {
        emittedRef.current = undefined;
        onCommit(undefined);
        return;
      }
      const parsed = parseDecimal(nextText);
      if (parsed === null) return;
      emittedRef.current = parsed;
      onCommit(parsed);
    },
    [onCommit]
  );

  const onBlur = useCallback(() => {
    if (parseDecimal(text) !== null) return;
    setText(
      committedValue === undefined || committedValue === null ? '' : String(committedValue)
    );
  }, [committedValue, text]);

  return { text, onTextChange, onBlur };
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
        latitude: pinCoordinate(nextLatitude),
        longitude: pinCoordinate(nextLongitude),
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

  const commitLatitude = useCallback(
    (nextLatitude) => onChange({ ...value, latitude: nextLatitude }),
    [onChange, value]
  );
  const commitLongitude = useCallback(
    (nextLongitude) => onChange({ ...value, longitude: nextLongitude }),
    [onChange, value]
  );
  const latitudeField = useCoordinateField(latitude, commitLatitude);
  const longitudeField = useCoordinateField(longitude, commitLongitude);

  const coordinateHint = useMemo(() => {
    const typedLatitude = parseDecimal(latitudeField.text);
    const typedLongitude = parseDecimal(longitudeField.text);
    if (typedLatitude !== null && Math.abs(typedLatitude) > 90) {
      return 'Latitude runs from -90 to 90.';
    }
    if (typedLongitude !== null && Math.abs(typedLongitude) > 180) {
      return 'Longitude runs from -180 to 180.';
    }
    return '';
  }, [latitudeField.text, longitudeField.text]);

  // Place search: a name goes to the geocoder, a coordinate pair goes straight
  // to the map. Either way the search runs when asked, not on every keystroke.
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeResults, setPlaceResults] = useState([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [placeSearchError, setPlaceSearchError] = useState('');
  const [isPlaceListOpen, setIsPlaceListOpen] = useState(false);
  const [activePlaceIndex, setActivePlaceIndex] = useState(0);
  const [flyRequest, setFlyRequest] = useState(null);
  const placeSearchBoxRef = useRef(null);
  const placeSearchAbortRef = useRef(null);

  useEffect(() => () => placeSearchAbortRef.current?.abort(), []);

  const flyTo = useCallback((nextLatitude, nextLongitude) => {
    setFlyRequest({
      id: Date.now(),
      latitude: nextLatitude,
      longitude: nextLongitude,
      zoom: SEARCH_RESULT_ZOOM,
    });
  }, []);

  const choosePlace = useCallback(
    (place) => {
      const nextLatitude = pinCoordinate(place.latitude);
      const nextLongitude = pinCoordinate(place.longitude);
      const keepsName = (value?.locationName ?? '').trim().length > 0;
      onChange({
        ...value,
        latitude: nextLatitude,
        longitude: nextLongitude,
        locationName: keepsName ? value.locationName : place.name,
      });
      flyTo(nextLatitude, nextLongitude);
      setPlaceQuery(place.name);
      setIsPlaceListOpen(false);
    },
    [flyTo, onChange, value]
  );

  const runPlaceSearch = useCallback(async () => {
    const query = placeQuery.trim();
    if (!query) return;
    setPlaceSearchError('');

    const typedPair = parseCoordinatePair(query);
    if (typedPair) {
      placePin(typedPair.latitude, typedPair.longitude);
      flyTo(typedPair.latitude, typedPair.longitude);
      setPlaceResults([]);
      setIsPlaceListOpen(false);
      return;
    }

    placeSearchAbortRef.current?.abort();
    const controller = new AbortController();
    placeSearchAbortRef.current = controller;
    setIsSearchingPlaces(true);
    try {
      const places = await searchPlaces(GEOCODER_URL, query, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setPlaceResults(places);
      setActivePlaceIndex(0);
      setIsPlaceListOpen(true);
    } catch (error) {
      if (controller.signal.aborted) return;
      setPlaceResults([]);
      setIsPlaceListOpen(false);
      setPlaceSearchError(describePlaceSearchError(error));
    } finally {
      if (placeSearchAbortRef.current === controller) {
        setIsSearchingPlaces(false);
      }
    }
  }, [flyTo, placePin, placeQuery]);

  const onPlaceSearchKeyDown = useCallback(
    (keyEvent) => {
      if (keyEvent.key === 'Escape') {
        setIsPlaceListOpen(false);
        return;
      }
      const listIsUsable = isPlaceListOpen && placeResults.length > 0;
      if (keyEvent.key === 'ArrowDown' && listIsUsable) {
        keyEvent.preventDefault();
        setActivePlaceIndex((index) => (index + 1) % placeResults.length);
        return;
      }
      if (keyEvent.key === 'ArrowUp' && listIsUsable) {
        keyEvent.preventDefault();
        setActivePlaceIndex(
          (index) => (index - 1 + placeResults.length) % placeResults.length
        );
        return;
      }
      if (keyEvent.key === 'Enter') {
        // The picker sits inside a form on the create screen; Enter here must
        // search, not submit the whole avatar.
        keyEvent.preventDefault();
        if (listIsUsable) {
          choosePlace(placeResults[activePlaceIndex] ?? placeResults[0]);
        } else {
          runPlaceSearch();
        }
      }
    },
    [activePlaceIndex, choosePlace, isPlaceListOpen, placeResults, runPlaceSearch]
  );

  const showPlaceList = isPlaceListOpen && placeQuery.trim().length > 0;

  return (
    <div className="space-y-3">
      <div
        ref={placeSearchBoxRef}
        className="relative z-10"
        onBlur={(blurEvent) => {
          if (!placeSearchBoxRef.current?.contains(blurEvent.relatedTarget)) {
            setIsPlaceListOpen(false);
          }
        }}
      >
        <div className="flex gap-2">
          <label className="relative block flex-1">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
              aria-hidden="true"
            />
            <input
              type="search"
              role="combobox"
              aria-expanded={showPlaceList}
              aria-controls="avatar-place-search-list"
              aria-activedescendant={
                showPlaceList && placeResults[activePlaceIndex]
                  ? `avatar-place-option-${activePlaceIndex}`
                  : undefined
              }
              aria-autocomplete="list"
              aria-label="Search for a place or type coordinates"
              value={placeQuery}
              onChange={(changeEvent) => {
                setPlaceQuery(changeEvent.target.value);
                setPlaceSearchError('');
                if (!changeEvent.target.value.trim()) {
                  setPlaceResults([]);
                  setIsPlaceListOpen(false);
                }
              }}
              onFocus={() => {
                if (placeResults.length > 0) setIsPlaceListOpen(true);
              }}
              onKeyDown={onPlaceSearchKeyDown}
              placeholder="Search a place, or type 44.9812, -93.2565"
              className="w-full rounded-md border border-white/10 bg-black/40 py-1.5 pl-9 pr-3 text-sm text-neutral-200 placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
            />
          </label>
          <button
            type="button"
            onClick={runPlaceSearch}
            disabled={isSearchingPlaces || !placeQuery.trim()}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-neutral-200 hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:opacity-60"
          >
            {isSearchingPlaces ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Find
          </button>
        </div>
        {showPlaceList ? (
          <div className="absolute left-0 right-0 top-full mt-1 rounded-lg border border-white/10 bg-black/80 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-lg">
            {placeResults.length === 0 ? (
              <p className="px-3 py-2 text-xs text-white/40">
                No places match that search. Try adding a city or country.
              </p>
            ) : (
              <ul
                id="avatar-place-search-list"
                role="listbox"
                className="max-h-56 overflow-y-auto px-1.5 py-1.5"
              >
                {placeResults.map((place, index) => (
                  <li
                    key={place.id}
                    id={`avatar-place-option-${index}`}
                    role="option"
                    aria-selected={index === activePlaceIndex}
                  >
                    <button
                      type="button"
                      onMouseEnter={() => setActivePlaceIndex(index)}
                      onClick={() => choosePlace(place)}
                      className={`flex w-full flex-col items-start gap-0.5 rounded-md px-2.5 py-1.5 text-left focus:outline-none ${
                        index === activePlaceIndex ? 'bg-white/10' : 'hover:bg-white/5'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 text-sm text-neutral-100">
                        <MapPin className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
                        {place.name}
                      </span>
                      {place.description && place.description !== place.name ? (
                        <span className="pl-5 text-xs text-white/50">{place.description}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>

      {placeSearchError && <p className="text-xs text-red-300">{placeSearchError}</p>}

      <div
        className={`${heightClassName} relative isolate z-0 w-full overflow-hidden rounded-lg border border-white/10`}
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
          <FlyToRequest request={flyRequest} />
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

      <p className="text-xs leading-relaxed text-white/50">
        Click or drag to place. Stand in the circle and the avatar opens on the
        phone. 1 m is a doorway.
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

      {/* Plain text inputs: a phone's decimal keypad has no minus key, and
          half the planet has a negative latitude or longitude. */}
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-white/60">
          Latitude
          <input
            type="text"
            autoComplete="off"
            placeholder="44.9812"
            value={latitudeField.text}
            onChange={(changeEvent) => latitudeField.onTextChange(changeEvent.target.value)}
            onBlur={latitudeField.onBlur}
            className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-neutral-200 placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
          />
        </label>
        <label className="text-xs text-white/60">
          Longitude
          <input
            type="text"
            autoComplete="off"
            placeholder="-93.2565"
            value={longitudeField.text}
            onChange={(changeEvent) => longitudeField.onTextChange(changeEvent.target.value)}
            onBlur={longitudeField.onBlur}
            className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-neutral-200 placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
          />
        </label>
      </div>
      {coordinateHint && <p className="text-xs text-red-300">{coordinateHint}</p>}

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
        <span className="mt-1 block text-[11px] leading-relaxed text-white/40">
          Spoken name. Never coordinates.
        </span>
      </label>

      <GeofenceRadiusField
        radiusMeters={radiusMeters}
        onChange={(nextRadiusMeters) =>
          onChange({
            ...value,
            geofenceRadiusMeters: nextRadiusMeters,
          })
        }
      />
    </div>
  );
};

export default AvatarLocationPicker;
