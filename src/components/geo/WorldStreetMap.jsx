// src/components/geo/WorldStreetMap.jsx
//
// Street-level companion to the globe. The globe stays on screen; this map
// shows the same pins at doorway scale, lets two avatars on one block stay
// distinct, and is where a created pin is moved or removed.

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { DomEvent } from 'leaflet';
import {
  Circle,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import { Trash2 } from 'lucide-react';

import { MAP_TILE_ATTRIBUTION, MAP_TILE_URL } from '../../config/maps';
import { mapMarkOf } from '../../services/avatarMapMark';
import {
  DEFAULT_GEOFENCE_RADIUS_METERS,
  METERS_PER_MILE,
  avatarIdOf,
  mapKeyOf,
  clampGeofenceRadius,
  describeGeofenceRadius,
  formatCoordinate,
  isValidCoordinate,
  milesFromMeters,
  pinOf,
  spreadStackedPinPositions,
} from '../../services/avatarProximity';
import { devicePositionIcon, labeledPinIcon } from './avatarPinMarker';
import 'leaflet/dist/leaflet.css';
import './leafletMapStyles.css';

const FALLBACK_CENTER = [39.5, -98.35];

function RecenterMapOn({
  latitude,
  longitude,
  zoom,
  enabled,
  suppressRef,
  revision,
  isVisible = true,
}) {
  const map = useMap();
  useEffect(() => {
    if (!isVisible) return undefined;
    map.invalidateSize();
    if (!enabled || !isValidCoordinate(latitude, longitude)) return undefined;
    if (suppressRef) suppressRef.current = true;
    map.setView([latitude, longitude], zoom ?? Math.max(map.getZoom(), 16), {
      animate: true,
    });
    const release = window.setTimeout(() => {
      map.invalidateSize();
      if (suppressRef) suppressRef.current = false;
    }, 500);
    return () => window.clearTimeout(release);
  }, [enabled, latitude, longitude, zoom, map, suppressRef, revision, isVisible]);
  return null;
}

function FitLeafletToInset({ isVisible = true }) {
  const map = useMap();
  useEffect(() => {
    if (!isVisible) return undefined;
    const frame = window.requestAnimationFrame(() => {
      map.invalidateSize();
    });
    const later = window.setTimeout(() => {
      map.invalidateSize();
    }, 80);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(later);
    };
  }, [map, isVisible]);
  return null;
}

function ReportStreetView({ onUserView, suppressRef }) {
  const map = useMap();
  useEffect(() => {
    const report = () => {
      if (suppressRef?.current) return;
      const center = map.getCenter();
      onUserView?.({
        latitude: center.lat,
        longitude: center.lng,
        source: 'street',
        preserveAssistant: true,
      });
    };
    map.on('dragend', report);
    return () => {
      map.off('dragend', report);
    };
  }, [map, onUserView, suppressRef]);
  return null;
}

function ClickStreetToFocus({ onPlace }) {
  useMapEvents({
    click: (mapEvent) => {
      onPlace?.({
        latitude: mapEvent.latlng.lat,
        longitude: mapEvent.latlng.lng,
        source: 'street',
      });
    },
  });
  return null;
}

function OwnedPinEditor({ avatar, pin, onSave, onRemove, onOpen, isSaving }) {
  const [latitude, setLatitude] = useState(String(pin.latitude));
  const [longitude, setLongitude] = useState(String(pin.longitude));
  const [locationName, setLocationName] = useState(pin.location_name ?? '');
  const [unit, setUnit] = useState('m');
  const [radiusInput, setRadiusInput] = useState(
    String(pin.geofence_radius_meters ?? DEFAULT_GEOFENCE_RADIUS_METERS)
  );

  useEffect(() => {
    setLatitude(String(pin.latitude));
    setLongitude(String(pin.longitude));
    setLocationName(pin.location_name ?? '');
    setRadiusInput(
      unit === 'mi'
        ? milesFromMeters(
            pin.geofence_radius_meters ?? DEFAULT_GEOFENCE_RADIUS_METERS
          ).toFixed(2)
        : String(pin.geofence_radius_meters ?? DEFAULT_GEOFENCE_RADIUS_METERS)
    );
    // The unit toggle is the person's choice; only the pin itself resets fields.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin.latitude, pin.longitude, pin.location_name, pin.geofence_radius_meters]);

  const radiusMeters =
    unit === 'mi'
      ? clampGeofenceRadius(Number(radiusInput) * METERS_PER_MILE)
      : clampGeofenceRadius(Number(radiusInput));

  return (
    <div className="space-y-1.5 min-w-[14rem]">
      <p className="font-medium text-neutral-100">{avatar.name ?? 'Avatar'}</p>
      <label className="block text-white/50">
        Place name
        <input
          type="text"
          value={locationName}
          onChange={(event) => setLocationName(event.target.value)}
          className="mt-0.5 w-full rounded border border-white/10 bg-black/40 px-1.5 py-1 text-neutral-200"
        />
      </label>
      <div className="grid grid-cols-2 gap-1">
        <label className="text-white/50">
          Latitude
          <input
            type="text"
            inputMode="decimal"
            value={latitude}
            onChange={(event) => setLatitude(event.target.value)}
            className="mt-0.5 w-full rounded border border-white/10 bg-black/40 px-1.5 py-1 text-neutral-200"
          />
        </label>
        <label className="text-white/50">
          Longitude
          <input
            type="text"
            inputMode="decimal"
            value={longitude}
            onChange={(event) => setLongitude(event.target.value)}
            className="mt-0.5 w-full rounded border border-white/10 bg-black/40 px-1.5 py-1 text-neutral-200"
          />
        </label>
      </div>
      <label className="block text-white/50">
        Here within ({unit === 'mi' ? 'miles' : 'meters'})
        <input
          type="number"
          min={unit === 'mi' ? 0.001 : 1}
          step={unit === 'mi' ? 0.01 : 1}
          value={radiusInput}
          onChange={(event) => setRadiusInput(event.target.value)}
          className="mt-0.5 w-full rounded border border-white/10 bg-black/40 px-1.5 py-1 text-neutral-200"
        />
        <span className="mt-0.5 block text-white/40">
          {describeGeofenceRadius(radiusMeters)}
        </span>
      </label>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => {
            setUnit('m');
            setRadiusInput(String(radiusMeters));
          }}
          className={`rounded px-1.5 py-0.5 text-[10px] ${
            unit === 'm' ? 'bg-white/10 text-neutral-100' : 'text-white/50'
          }`}
        >
          meters
        </button>
        <button
          type="button"
          onClick={() => {
            setUnit('mi');
            setRadiusInput(milesFromMeters(radiusMeters).toFixed(2));
          }}
          className={`rounded px-1.5 py-0.5 text-[10px] ${
            unit === 'mi' ? 'bg-white/10 text-neutral-100' : 'text-white/50'
          }`}
        >
          miles
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5 pt-1">
        <button
          type="button"
          disabled={isSaving}
          onClick={() =>
            onSave(avatar, {
              latitude: Number(latitude),
              longitude: Number(longitude),
              locationName,
              geofenceRadiusMeters: radiusMeters,
            })
          }
          className="rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs text-neutral-200"
        >
          {isSaving ? 'Saving…' : 'Save place'}
        </button>
        <button
          type="button"
          onClick={() => onOpen(avatar)}
          className="rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs text-neutral-200"
        >
          Talk
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={() => onRemove(avatar)}
          className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs text-white/70"
        >
          <Trash2 className="h-3 w-3" aria-hidden="true" />
          Remove
        </button>
      </div>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {Array<Object>} props.avatars
 * @param {Object|null} props.devicePosition
 * @param {Object|null} [props.focus]
 * @param {Set<string>} [props.ownedAssistantIds]
 * @param {(avatar: Object) => void} props.onOpenAvatar
 * @param {(avatar: Object) => void} [props.onRemovePin]
 * @param {(avatar: Object, pin: Object) => void} [props.onSavePin]
 * @param {string} [props.savingAssistantId]
 */
const WorldStreetMap = ({
  appearance = 'panel',
  avatars = [],
  devicePosition = null,
  focus = null,
  selectedAssistantId,
  ownedAssistantIds,
  onOpenAvatar,
  onRemovePin,
  onSavePin,
  onFocusChange,
  savingAssistantId = '',
  isVisible = true,
}) => {
  const suppressViewReportRef = useRef(false);
  const followFocus = focus?.source && focus.source !== 'street';
  const spreadPositions = useMemo(
    () => spreadStackedPinPositions(avatars),
    [avatars]
  );
  const selectedSpread = selectedAssistantId
    ? spreadPositions.get(selectedAssistantId)
    : null;
  const followLatitude = selectedSpread?.latitude ?? focus?.latitude;
  const followLongitude = selectedSpread?.longitude ?? focus?.longitude;
  const center = useMemo(() => {
    if (isValidCoordinate(followLatitude, followLongitude)) {
      return [followLatitude, followLongitude];
    }
    if (devicePosition) {
      return [devicePosition.latitude, devicePosition.longitude];
    }
    const firstPin = pinOf(avatars[0]);
    if (firstPin) return [Number(firstPin.latitude), Number(firstPin.longitude)];
    return FALLBACK_CENTER;
  }, [avatars, devicePosition, followLatitude, followLongitude]);

  const startZoom = focus || devicePosition ? 18 : avatars.length ? 12 : 3;

  return (
    <div className="h-full w-full overflow-hidden">
      <MapContainer
        center={center}
        zoom={startZoom}
        minZoom={2}
        maxZoom={19}
        scrollWheelZoom
        zoomControl={appearance !== 'minimap'}
        style={{ height: '100%', width: '100%', minHeight: appearance === 'minimap' ? '12rem' : undefined }}
        className={`neural-nexus-map h-full w-full${
          appearance === 'minimap' ? ' neural-nexus-minimap' : ''
        }`}
      >
        <TileLayer url={MAP_TILE_URL} attribution={MAP_TILE_ATTRIBUTION} />
        <FitLeafletToInset isVisible={isVisible} />
        <RecenterMapOn
          latitude={followLatitude}
          longitude={followLongitude}
          zoom={18}
          enabled={Boolean(followFocus)}
          suppressRef={suppressViewReportRef}
          revision={`${selectedAssistantId ?? ''}:${focus?.revision ?? 0}`}
          isVisible={isVisible}
        />
        <ReportStreetView
          onUserView={onFocusChange}
          suppressRef={suppressViewReportRef}
        />
        <ClickStreetToFocus onPlace={onFocusChange} />
        {devicePosition && (
          <Marker
            position={[devicePosition.latitude, devicePosition.longitude]}
            icon={devicePositionIcon}
          >
            <Popup>You are here</Popup>
          </Marker>
        )}
        {avatars.map((avatar) => {
          const pin = pinOf(avatar);
          const assistantId = avatarIdOf(avatar);
          const markerKey = mapKeyOf(avatar);
          if (!pin || !markerKey) return null;
          const latitude = Number(pin.latitude);
          const longitude = Number(pin.longitude);
          const markerPosition = spreadPositions.get(markerKey) ?? {
            latitude,
            longitude,
          };
          const isOwned = assistantId
            ? ownedAssistantIds?.has(assistantId)
            : false;
          const isSelected =
            selectedAssistantId === assistantId ||
            selectedAssistantId === markerKey;
          const mark = mapMarkOf(avatar);
          return (
            <Fragment key={markerKey}>
              <Circle
                center={[latitude, longitude]}
                radius={
                  pin.geofence_radius_meters ?? DEFAULT_GEOFENCE_RADIUS_METERS
                }
                pathOptions={{
                  color: isSelected || isOwned ? '#fbbf24' : '#d4d4d4',
                  weight: isSelected ? 2 : 1,
                  fillOpacity: isSelected ? 0.2 : 0.12,
                }}
              />
              <Marker
                position={[markerPosition.latitude, markerPosition.longitude]}
                icon={labeledPinIcon({
                  initials: mark.initials,
                  owned: isOwned,
                })}
                draggable={Boolean(isOwned && onSavePin)}
                eventHandlers={{
                  click: (event) => {
                    DomEvent.stopPropagation(event);
                    onFocusChange?.({
                      latitude,
                      longitude,
                      assistantId: assistantId ?? markerKey,
                      source: 'street',
                    });
                  },
                  ...(isOwned && onSavePin
                    ? {
                        dragend: (dragEvent) => {
                          const moved = dragEvent.target.getLatLng();
                          onSavePin(avatar, {
                            latitude: Number(moved.lat.toFixed(6)),
                            longitude: Number(moved.lng.toFixed(6)),
                            locationName: pin.location_name ?? '',
                            geofenceRadiusMeters:
                              pin.geofence_radius_meters ??
                              DEFAULT_GEOFENCE_RADIUS_METERS,
                          });
                        },
                      }
                    : {}),
                }}
              >
                <Popup>
                  {isOwned && onSavePin ? (
                    <OwnedPinEditor
                      avatar={avatar}
                      pin={pin}
                      isSaving={savingAssistantId === assistantId}
                      onSave={onSavePin}
                      onRemove={onRemovePin}
                      onOpen={onOpenAvatar}
                    />
                  ) : (
                    <div className="space-y-1.5">
                      <p className="font-medium text-neutral-100">
                        {mark.label}
                      </p>
                      {pin.location_name ? (
                        <p className="text-amber-300">{pin.location_name}</p>
                      ) : null}
                      <p className="text-white/50">
                        {formatCoordinate(latitude)}, {formatCoordinate(longitude)}
                      </p>
                      <p className="text-white/40">
                        {describeGeofenceRadius(pin.geofence_radius_meters)}
                      </p>
                      <button
                        type="button"
                        onClick={() => onOpenAvatar?.(avatar)}
                        className="rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs text-neutral-200"
                      >
                        Talk
                      </button>
                    </div>
                  )}
                </Popup>
              </Marker>
            </Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default WorldStreetMap;
