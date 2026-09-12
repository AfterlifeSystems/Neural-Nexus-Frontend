// src/services/avatarProximity.js
//
// The pure geometry and shaping behind geo-located avatars: turning a pin the
// user edited into the query parameters /create_avatar and /modify_avatar
// expect, turning a map viewport into the bounding box /avatars/geo expects,
// measuring how far away a pin is, and grouping pins that would otherwise land
// on top of each other on a zoomed-out globe.
//
// No JSX and no import.meta.env, so the Node test runner can import this file.

// These bounds match the API. The field must never send a radius outside them.
export const DEFAULT_GEOFENCE_RADIUS_METERS = 1;
export const MINIMUM_GEOFENCE_RADIUS_METERS = 1;
export const MAXIMUM_GEOFENCE_RADIUS_METERS = 5000;
export const GEOFENCE_RADIUS_PRECISION_METERS = 0.01;
export const DOORWAY_GEOFENCE_RADIUS_METERS = 1;
export const METERS_PER_KILOMETER = 1000;
export const METERS_PER_YARD = 0.9144;
export const METERS_PER_MILE = 1609.344;
// Seven decimal places is about 1.1 cm — enough to name a one-metre doorway.
export const PIN_COORDINATE_DIGITS = 7;

export const GEOFENCE_RADIUS_UNITS = {
  m: {
    id: 'm',
    label: 'm',
    group: 'metric',
    metersPerUnit: 1,
    step: 0.01,
    displayDigits: 2,
  },
  km: {
    id: 'km',
    label: 'km',
    group: 'metric',
    metersPerUnit: METERS_PER_KILOMETER,
    step: 0.00001,
    displayDigits: 5,
  },
  yd: {
    id: 'yd',
    label: 'yd',
    group: 'imperial',
    metersPerUnit: METERS_PER_YARD,
    step: 0.01,
    displayDigits: 2,
  },
  mi: {
    id: 'mi',
    label: 'mi',
    group: 'imperial',
    metersPerUnit: METERS_PER_MILE,
    // 0.000001 mi is about 1.6 mm. Two decimal places used to snap the
    // control to 0.10 mi (161 m) — the first value that looked non-zero.
    step: 0.000001,
    displayDigits: 6,
  },
};

export const GEOFENCE_RADIUS_UNIT_ORDER = ['m', 'km', 'yd', 'mi'];

// A desktop Wi-Fi / IP fix is often accurate only to a few kilometres (people
// read that as "about five miles"). Sending that figure to the API widens every
// geofence by the same amount, so "you are here" and the live camera fire from
// across town. Phone GPS is routinely within six metres; that is the arrival
// we honour. A reading worse than this is still useful for drawing the person
// on the map, but it cannot count as walking up to a doorway.
export const MAXIMUM_ACCURACY_WIDENING_METERS = 15;
export const MAXIMUM_ARRIVAL_ACCURACY_METERS = 50;

// Closest globe grouping: 0.000054 degrees of latitude is about six metres.
export const STREET_LEVEL_GROUPING_DEGREES = 0.000054;
// globe.gl HTML pins closer than this (~220 m) occupy the same screen point
// after a fly-in, so one name covers the other. Keep them one place, then fan.
export const GLOBE_VISUAL_GROUPING_DEGREES = 0.002;

const EARTH_RADIUS_METERS = 6371000;

/**
 * Whether a value is a usable coordinate number.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Whether a latitude and longitude pair names a real point on Earth.
 *
 * @param {number} latitude
 * @param {number} longitude
 * @returns {boolean}
 */
export function isValidCoordinate(latitude, longitude) {
  if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) return false;
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

/**
 * Clamp a geofence radius to the range the API accepts.
 *
 * @param {unknown} radiusMeters
 * @returns {number} Metres, rounded to the nearest centimetre.
 */
export function clampGeofenceRadius(radiusMeters) {
  const radius = Number(radiusMeters);
  if (!Number.isFinite(radius)) return DEFAULT_GEOFENCE_RADIUS_METERS;
  const centimetres = Math.round(radius / GEOFENCE_RADIUS_PRECISION_METERS);
  const rounded = centimetres * GEOFENCE_RADIUS_PRECISION_METERS;
  return Math.min(
    MAXIMUM_GEOFENCE_RADIUS_METERS,
    Math.max(MINIMUM_GEOFENCE_RADIUS_METERS, rounded)
  );
}

/**
 * The query parameters that pin an avatar to a place.
 *
 * Returns an empty object for a missing or incomplete pin, so a caller that
 * spreads the result into a request sends nothing at all when the avatar has
 * no place — the API treats absent coordinates as "leave the pin alone".
 *
 * @param {Object|null|undefined} geoLocation
 * @param {number} geoLocation.latitude
 * @param {number} geoLocation.longitude
 * @param {string} [geoLocation.locationName]
 * @param {number} [geoLocation.geofenceRadiusMeters]
 * @returns {Object} Snake-case query parameters.
 */
export function geoLocationQuery(geoLocation) {
  if (!geoLocation) return {};
  const { latitude, longitude, locationName, geofenceRadiusMeters } = geoLocation;
  if (!isValidCoordinate(latitude, longitude)) return {};
  const query = { latitude, longitude };
  const trimmedName = (locationName ?? '').trim();
  if (trimmedName) query.location_name = trimmedName;
  if (geofenceRadiusMeters !== undefined && geofenceRadiusMeters !== null) {
    query.geofence_radius_meters = clampGeofenceRadius(geofenceRadiusMeters);
  }
  return query;
}

/**
 * The bounding-box query parameters for a map viewport.
 *
 * A viewport dragged past the antimeridian keeps its minimum longitude greater
 * than its maximum; the API reads that as a wrap rather than an empty box, so
 * the bounds are passed through unchanged.
 *
 * @param {Object|null|undefined} bounds
 * @returns {Object} Snake-case query parameters.
 */
export function boundsQuery(bounds) {
  if (!bounds) return {};
  const { minLatitude, minLongitude, maxLatitude, maxLongitude } = bounds;
  const query = {};
  if (isFiniteNumber(minLatitude)) query.min_latitude = minLatitude;
  if (isFiniteNumber(minLongitude)) query.min_longitude = minLongitude;
  if (isFiniteNumber(maxLatitude)) query.max_latitude = maxLatitude;
  if (isFiniteNumber(maxLongitude)) query.max_longitude = maxLongitude;
  return query;
}

/**
 * Great-circle distance between two coordinates, in meters.
 *
 * @param {number} latitudeA
 * @param {number} longitudeA
 * @param {number} latitudeB
 * @param {number} longitudeB
 * @returns {number} Meters.
 */
export function distanceInMeters(latitudeA, longitudeA, latitudeB, longitudeB) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const deltaLatitude = toRadians(latitudeB - latitudeA);
  const deltaLongitude = toRadians(longitudeB - longitudeA);
  const chord =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(toRadians(latitudeA)) *
      Math.cos(toRadians(latitudeB)) *
      Math.sin(deltaLongitude / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.min(1, chord)));
}

/**
 * A distance written the way a person reads one.
 *
 * @param {number|null|undefined} meters
 * @returns {string} For example "40 m", "1.2 km", or an empty string.
 */
export function describeDistance(meters) {
  if (!isFiniteNumber(meters) || meters < 0) return '';
  if (meters === 0) return '0 m';
  // A positive gap must never round to "0 m" — that is what a 1 m doorway
  // looked like when Math.round ate anything under half a metre.
  if (meters < 1) return `${meters < 0.1 ? meters.toFixed(2) : meters.toFixed(1)} m`;
  if (meters < METERS_PER_MILE) return `${Math.round(meters)} m`;
  const miles = meters / METERS_PER_MILE;
  const milesText = miles < 10 ? miles.toFixed(1) : String(Math.round(miles));
  return `${milesText} mi (${Math.round(meters)} m)`;
}

/**
 * Trim trailing zeros from a decimal so "0.50" reads as "0.5" and "6.00" as "6",
 * without ever collapsing "0.000311" to "0".
 *
 * @param {string} text
 * @returns {string}
 */
function trimTrailingZeros(text) {
  if (!text.includes('.')) return text;
  return text.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

/**
 * The unit record for a geofence radius control.
 *
 * @param {unknown} unitId
 * @returns {typeof GEOFENCE_RADIUS_UNITS[keyof typeof GEOFENCE_RADIUS_UNITS]}
 */
export function geofenceRadiusUnitOf(unitId) {
  return GEOFENCE_RADIUS_UNITS[unitId] ?? GEOFENCE_RADIUS_UNITS.m;
}

/**
 * @param {unknown} value
 * @param {unknown} unitId
 * @returns {number}
 */
export function metersFromRadiusUnit(value, unitId) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return DEFAULT_GEOFENCE_RADIUS_METERS;
  return clampGeofenceRadius(amount * geofenceRadiusUnitOf(unitId).metersPerUnit);
}

/**
 * @param {unknown} meters
 * @param {unknown} unitId
 * @returns {number}
 */
export function radiusUnitFromMeters(meters, unitId) {
  const amount = Number(meters);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return amount / geofenceRadiusUnitOf(unitId).metersPerUnit;
}

/**
 * The typed value of a radius in the chosen unit, with enough digits that a
 * one-metre doorway does not become "0.00 mi".
 *
 * @param {unknown} meters
 * @param {unknown} unitId
 * @returns {string}
 */
export function formatRadiusUnitValue(meters, unitId) {
  const unit = geofenceRadiusUnitOf(unitId);
  const amount = radiusUnitFromMeters(meters, unitId);
  return trimTrailingZeros(amount.toFixed(unit.displayDigits));
}

/**
 * @param {unknown} unitId
 * @returns {number}
 */
export function radiusUnitMinimum(unitId) {
  return radiusUnitFromMeters(MINIMUM_GEOFENCE_RADIUS_METERS, unitId);
}

/**
 * @param {unknown} unitId
 * @returns {number}
 */
export function radiusUnitMaximum(unitId) {
  return radiusUnitFromMeters(MAXIMUM_GEOFENCE_RADIUS_METERS, unitId);
}

/**
 * Metres written so 1 stays 1 and 1.5 stays 1.5.
 *
 * @param {number} meters
 * @returns {string}
 */
function formatMetersLabel(meters) {
  if (Math.abs(meters - Math.round(meters)) < 0.0005) {
    return `${Math.round(meters)} m`;
  }
  return `${trimTrailingZeros(meters.toFixed(2))} m`;
}

/**
 * A geofence radius in base-ten metric, the units a visitor already knows.
 *
 * @param {unknown} meters
 * @returns {string}
 */
export function describeGeofenceRadius(meters) {
  const radius = clampGeofenceRadius(meters);
  if (radius >= METERS_PER_KILOMETER) {
    return `${trimTrailingZeros((radius / METERS_PER_KILOMETER).toFixed(3))} km`;
  }
  return formatMetersLabel(radius);
}

/**
 * @param {unknown} miles
 * @returns {number}
 */
export function metersFromMiles(miles) {
  return metersFromRadiusUnit(miles, 'mi');
}

/**
 * @param {unknown} meters
 * @returns {number}
 */
export function milesFromMeters(meters) {
  return radiusUnitFromMeters(meters, 'mi');
}

/**
 * Pull a list of avatar records out of whatever shape a listing used.
 *
 * GET /avatars/geo and GET /avatars/nearby have returned both a bare array and
 * an `{avatars}` wrapper. Treating only the wrapper as success dropped every
 * public pin and left the globe looking empty except for the caller's own.
 *
 * @param {*} response
 * @returns {Array}
 */
export function avatarsFromResponse(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.avatars)) return response.avatars;
  if (Array.isArray(response?.items)) return response.items;
  return [];
}

/**
 * Read a latitude/longitude pair from any of the field names a pin has used.
 *
 * @param {Object|null|undefined} value
 * @returns {Object|null}
 */
/**
 * A coordinate the API may have sent as a number or a numeric string.
 * Empty strings must not become 0 — that is Null Island, not a missing pin.
 *
 * @param {unknown} value
 * @returns {number}
 */
function coordinateNumber(value) {
  if (value === '' || value === null || value === undefined) return Number.NaN;
  if (typeof value === 'string' && value.trim() === '') return Number.NaN;
  const number = Number(value);
  return Number.isFinite(number) ? number : Number.NaN;
}

/**
 * A GeoJSON point `{type:'Point', coordinates:[lng, lat]}`.
 *
 * @param {Object} value
 * @returns {Object|null}
 */
function pinFromGeoJson(value) {
  const coordinates = value.coordinates ?? value.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const longitude = coordinateNumber(coordinates[0]);
  const latitude = coordinateNumber(coordinates[1]);
  if (!isValidCoordinate(latitude, longitude)) return null;
  return { latitude, longitude };
}

function pinFromUnknown(value) {
  if (!value || typeof value !== 'object') return null;
  const latitude = coordinateNumber(
    value.latitude ?? value.lat ?? value.Latitude
  );
  const longitude = coordinateNumber(
    value.longitude ?? value.lng ?? value.lon ?? value.Longitude
  );
  const pin = isValidCoordinate(latitude, longitude)
    ? { latitude, longitude }
    : pinFromGeoJson(value);
  if (!pin) return null;
  if (value.location_name !== undefined || value.locationName !== undefined) {
    pin.location_name = value.location_name ?? value.locationName ?? null;
  }
  const radius = value.geofence_radius_meters ?? value.geofenceRadiusMeters;
  if (radius !== undefined && radius !== null) {
    pin.geofence_radius_meters = radius;
  }
  return pin;
}

/**
 * The pin carried by an avatar record, from either shape the API returns.
 *
 * The creator's own record keeps the pin inside the metadata; a public listing
 * lifts the pin to the top level and drops the metadata entirely. Some listings
 * flatten latitude and longitude onto the avatar itself.
 *
 * @param {Object|null|undefined} avatar
 * @returns {Object|null} The geo_location block, or null when unpinned.
 */
export function pinOf(avatar) {
  if (!avatar) return null;
  return (
    pinFromUnknown(avatar.metadata?.geo_location) ??
    pinFromUnknown(avatar.geo_location) ??
    pinFromUnknown(avatar.metadata?.location) ??
    pinFromUnknown(avatar.location) ??
    pinFromUnknown(avatar.metadata) ??
    pinFromUnknown(avatar)
  );
}

/**
 * The id an avatar record carries, from either field the API uses.
 *
 * @param {Object|null|undefined} avatar
 * @returns {string|null}
 */
export function avatarIdOf(avatar) {
  return (
    avatar?.assistant_id ??
    avatar?.avatar_id ??
    avatar?.metadata?.assistant_id ??
    null
  );
}

/**
 * A stable key for drawing one pin. Avatars without an assistant id still
 * belong on the map, so the name and coordinates stand in.
 *
 * @param {Object|null|undefined} avatar
 * @returns {string|null}
 */
export function mapKeyOf(avatar) {
  const id = avatarIdOf(avatar);
  if (id) return String(id);
  const pin = pinOf(avatar);
  if (!pin) return null;
  const name = String(avatar?.name ?? '').trim();
  return `${name}:${Number(pin.latitude)}:${Number(pin.longitude)}`;
}

/**
 * Write a pin onto both shapes an avatar record uses, so a later read through
 * {@link pinOf} sees the new place (or the absence of one) rather than a stale
 * copy left in metadata.
 *
 * @param {Object|null|undefined} avatar
 * @param {Object|null} pin
 * @returns {Object|null|undefined}
 */
export function withPin(avatar, pin) {
  if (!avatar) return avatar;
  return {
    ...avatar,
    geo_location: pin,
    metadata: {
      ...(avatar.metadata ?? {}),
      geo_location: pin,
    },
  };
}

/**
 * Remove the pin from both shapes an avatar record uses.
 *
 * @param {Object|null|undefined} avatar
 * @returns {Object|null|undefined}
 */
export function withoutPin(avatar) {
  return withPin(avatar, null);
}

/**
 * Public globe pins plus the signed-in person's own pins, including private
 * ones. `/avatars/geo` only returns public avatars, so a pin just placed on a
 * private avatar would otherwise vanish from the world map.
 *
 * @param {Array<Object>|null|undefined} publicAvatars
 * @param {Array<Object>|null|undefined} ownedAvatars
 * @returns {Array<Object>}
 */
export function mergePinnedAvatars(publicAvatars, ownedAvatars) {
  const byId = new Map();
  const withoutId = [];
  const take = (avatar, preferThisPin) => {
    const pin = pinOf(avatar);
    if (!pin) return;
    const id = avatarIdOf(avatar);
    if (!id) {
      withoutId.push(withPin(avatar, pin));
      return;
    }
    const existing = byId.get(id);
    const nextPin = preferThisPin ? pin : pinOf(existing) ?? pin;
    byId.set(id, withPin({ ...(existing ?? {}), ...avatar }, nextPin));
  };
  for (const avatar of publicAvatars ?? []) take(avatar, false);
  for (const avatar of ownedAvatars ?? []) take(avatar, true);
  return [...byId.values(), ...withoutId];
}

/**
 * Cap the accuracy we send to the API so a kilometres-wide Wi-Fi fix cannot
 * widen a doorway-sized geofence.
 *
 * @param {unknown} accuracyMeters
 * @returns {number|undefined}
 */
export function cappedAccuracyMeters(accuracyMeters) {
  const accuracy = Number(accuracyMeters);
  if (!Number.isFinite(accuracy) || accuracy < 0) return undefined;
  return Math.min(accuracy, MAXIMUM_ACCURACY_WIDENING_METERS);
}

/**
 * Whether a distance reading counts as standing at a pin.
 *
 * @param {Object} options
 * @param {number} options.distanceMeters
 * @param {number} [options.radiusMeters]
 * @param {number} [options.accuracyMeters]
 * @returns {boolean}
 */
export function isInsideGeofence({
  distanceMeters,
  radiusMeters,
  accuracyMeters,
} = {}) {
  if (!isFiniteNumber(distanceMeters) || distanceMeters < 0) return false;
  if (
    isFiniteNumber(accuracyMeters) &&
    accuracyMeters > MAXIMUM_ARRIVAL_ACCURACY_METERS
  ) {
    return false;
  }
  const radius = clampGeofenceRadius(
    radiusMeters ?? DEFAULT_GEOFENCE_RADIUS_METERS
  );
  const widening = Math.min(
    isFiniteNumber(accuracyMeters) && accuracyMeters > 0 ? accuracyMeters : 0,
    MAXIMUM_ACCURACY_WIDENING_METERS
  );
  return distanceMeters <= radius + widening;
}

/**
 * Recompute distance and arrival from a nearby-API entry using the device
 * reading, so a coarse accuracy figure the server honoured cannot mark the
 * person as inside.
 *
 * @param {Object} entry
 * @param {Object} [position]
 * @param {number} [position.latitude]
 * @param {number} [position.longitude]
 * @param {number} [position.accuracyMeters]
 * @returns {Object}
 */
export function refineNearbyEntry(entry, position = {}) {
  const pin = entry?.geo_location;
  const latitude = Number(position.latitude);
  const longitude = Number(position.longitude);
  let distance = Number(entry?.distance_meters);
  if (
    !Number.isFinite(distance) &&
    pin &&
    isValidCoordinate(latitude, longitude) &&
    isValidCoordinate(Number(pin.latitude), Number(pin.longitude))
  ) {
    distance = distanceInMeters(
      latitude,
      longitude,
      Number(pin.latitude),
      Number(pin.longitude)
    );
  }
  return {
    ...entry,
    distance_meters: Number.isFinite(distance) ? distance : entry?.distance_meters,
    inside_geofence: isInsideGeofence({
      distanceMeters: distance,
      radiusMeters: pin?.geofence_radius_meters,
      accuracyMeters: position.accuracyMeters,
    }),
  };
}

/**
 * @param {Array<Object>|null|undefined} entries
 * @param {Object} [position]
 * @returns {Array<Object>}
 */
export function refineNearbyAvatars(entries, position) {
  return (entries ?? []).map((entry) => refineNearbyEntry(entry, position));
}

/**
 * How coarsely the spinning globe groups pins, by camera altitude in Earth
 * radii. Street-level altitude groups at about six metres so two doorways
 * on the same block can separate.
 *
 * @param {number} altitude
 * @returns {number} Degrees of latitude/longitude per cell.
 */
export function groupingDegreesForAltitude(altitude) {
  if (!Number.isFinite(altitude)) return 0.8;
  // World view used to bucket ~12° (~1300 km), so a whole coast became one
  // numbered cluster and people could not see the avatars they had placed.
  if (altitude > 1.8) return 1.2;
  if (altitude > 1.0) return 0.45;
  if (altitude > 0.5) return 0.12;
  if (altitude > 0.2) return 0.03;
  if (altitude > 0.08) return 0.008;
  if (altitude > 0.03) return 0.002;
  if (altitude > 0.01) return 0.0002;
  return STREET_LEVEL_GROUPING_DEGREES;
}

/**
 * How coarsely globe HTML markers cluster so overlapping names become a
 * number. Named pins are ~40px; two people in one city stay a count until
 * the camera is close enough that the markers would actually separate.
 *
 * @param {number} altitude
 * @returns {number} Degrees of latitude/longitude per cell.
 */
export function globeClusterDegreesForAltitude(altitude) {
  const grouping = groupingDegreesForAltitude(altitude);
  if (!Number.isFinite(altitude) || altitude > 1.0) {
    return Math.max(grouping, 0.8);
  }
  if (altitude > 0.4) return Math.max(grouping, 0.25);
  if (altitude > 0.15) return Math.max(grouping, 0.08);
  if (altitude > 0.05) return Math.max(grouping, 0.02);
  return Math.max(grouping, 0.008);
}

/**
 * Marker size on the globe, in degrees, shrinking as the camera comes in so a
 * pin is not a five-mile-wide blob when looking at a city block.
 *
 * @param {number} altitude
 * @param {number} [count]
 * @returns {number}
 */
export function globePointRadius(altitude, count = 1) {
  const size =
    !Number.isFinite(altitude) || altitude > 0.4
      ? 0.25
      : altitude > 0.15
        ? 0.08
        : altitude > 0.05
          ? 0.025
          : altitude > 0.015
            ? 0.008
            : 0.002;
  return size + Math.min(size, Math.log2(count + 1) * size * 0.35);
}

/**
 * A latitude or longitude written with enough digits for a six-metre place.
 *
 * @param {unknown} value
 * @param {number} [digits]
 * @returns {string}
 */
export function formatCoordinate(value, digits = PIN_COORDINATE_DIGITS) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return number.toFixed(digits);
}

/**
 * A coordinate stored with enough digits for a one-square-metre place.
 *
 * @param {unknown} value
 * @returns {number}
 */
export function pinCoordinate(value) {
  return Number(Number(value).toFixed(PIN_COORDINATE_DIGITS));
}

/**
 * Group pins that would overlap on a globe at the given grouping size.
 *
 * Pins are bucketed by a latitude and longitude grid rather than by true
 * distance: at globe zoom the grid is what the eye reads, and the arithmetic
 * stays cheap enough to run on every frame of a spin.
 *
 * @param {Array<Object>} avatars Avatar records carrying a pin.
 * @param {number} degreesPerCell Grid size in degrees; larger groups more.
 * @returns {Array<Object>} One entry per group: {latitude, longitude, avatars, count}.
 */
export function clusterPins(avatars, degreesPerCell = 5) {
  const cellSize = Number(degreesPerCell) > 0 ? Number(degreesPerCell) : 5;
  const groups = new Map();
  for (const avatar of avatars ?? []) {
    const pin = pinOf(avatar);
    if (!pin) continue;
    const latitude = Number(pin.latitude);
    const longitude = Number(pin.longitude);
    const key = `${Math.floor(latitude / cellSize)}:${Math.floor(longitude / cellSize)}`;
    const group = groups.get(key);
    if (group) {
      group.avatars.push(avatar);
      group.latitudeSum += latitude;
      group.longitudeSum += longitude;
    } else {
      groups.set(key, {
        avatars: [avatar],
        latitudeSum: latitude,
        longitudeSum: longitude,
      });
    }
  }
  return [...groups.values()].map((group) => ({
    id: group.avatars.map((avatar) => avatarIdOf(avatar)).filter(Boolean).join('|'),
    latitude: group.latitudeSum / group.avatars.length,
    longitude: group.longitudeSum / group.avatars.length,
    avatars: group.avatars,
    count: group.avatars.length,
  }));
}

/**
 * A stable key for pins that a person reads as the same doorway.
 *
 * Six decimal places is about eleven centimetres — two one-square-metre
 * doorways on the same block stay distinct.
 *
 * @param {unknown} latitude
 * @param {unknown} longitude
 * @param {number} [digits]
 * @returns {string}
 */
export function samePlaceKey(latitude, longitude, digits = 6) {
  if (!isValidCoordinate(Number(latitude), Number(longitude))) return '';
  return `${Number(latitude).toFixed(digits)}:${Number(longitude).toFixed(digits)}`;
}

/**
 * Every pinned avatar standing at the same doorway as a point.
 *
 * @param {Array<Object>|null|undefined} avatars
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Array<Object>}
 */
/**
 * The ids that belong with a map focus: a globe cluster, or the one avatar
 * just chosen, or the group already open so a list click does not lose the rest.
 *
 * @param {Object} place
 * @param {Array<Object>} [place.avatars]
 * @param {string|null} [place.assistantId]
 * @param {boolean} [place.preserveGroup]
 * @param {Object|null} [previous]
 * @param {Array<string>} [previous.groupIds]
 * @returns {Array<string>}
 */
export function groupIdsForFocus(place, previous = null) {
  if (place?.avatars?.length) {
    return place.avatars.map((avatar) => avatarIdOf(avatar)).filter(Boolean);
  }
  if (place?.preserveGroup && previous?.groupIds?.length) {
    return previous.groupIds;
  }
  if (place?.assistantId) return [place.assistantId];
  return previous?.groupIds ?? [];
}

/**
 * Resolve stored group ids back to avatar records, in the same order.
 *
 * @param {Array<Object>|null|undefined} avatars
 * @param {Array<string>|null|undefined} groupIds
 * @returns {Array<Object>}
 */
export function avatarsInFocusGroup(avatars, groupIds) {
  if (!groupIds?.length) return [];
  const byId = new Map();
  for (const avatar of avatars ?? []) {
    const id = avatarIdOf(avatar);
    if (id) byId.set(id, avatar);
  }
  return groupIds.map((id) => byId.get(id)).filter(Boolean);
}

export function avatarsAtSamePlace(avatars, latitude, longitude) {
  const key = samePlaceKey(latitude, longitude);
  if (!key) return [];
  return (avatars ?? []).filter((avatar) => {
    const pin = pinOf(avatar);
    return Boolean(pin && samePlaceKey(pin.latitude, pin.longitude) === key);
  });
}

/**
 * Pinned avatars within a walking distance of a point, nearest first.
 *
 * @param {Array<Object>|null|undefined} avatars
 * @param {number} latitude
 * @param {number} longitude
 * @param {number} meters
 * @returns {Array<Object>}
 */
export function avatarsWithinMeters(avatars, latitude, longitude, meters) {
  if (!isValidCoordinate(Number(latitude), Number(longitude))) return [];
  const radius = Number(meters);
  if (!Number.isFinite(radius) || radius < 0) return [];
  return (avatars ?? [])
    .map((avatar) => {
      const pin = pinOf(avatar);
      if (!pin) return null;
      const distance = distanceInMeters(
        Number(latitude),
        Number(longitude),
        Number(pin.latitude),
        Number(pin.longitude)
      );
      return distance <= radius ? { avatar, distance } : null;
    })
    .filter(Boolean)
    .sort((left, right) => left.distance - right.distance)
    .map((entry) => entry.avatar);
}

/**
 * Join grid cells that sit across a boundary but are still one place on screen.
 *
 * @param {Array<Object>} groups
 * @param {number} degrees
 * @returns {Array<Object>}
 */
function mergeGroupsWithinDegrees(groups, degrees) {
  if (!groups?.length || groups.length === 1) return groups ?? [];
  const meters = Number(degrees) * 111320;
  if (!Number.isFinite(meters) || meters <= 0) return groups;
  const remaining = groups.map((group) => ({
    ...group,
    avatars: [...group.avatars],
  }));
  for (let index = 0; index < remaining.length; index += 1) {
    const current = remaining[index];
    if (!current) continue;
    for (let otherIndex = index + 1; otherIndex < remaining.length; otherIndex += 1) {
      const other = remaining[otherIndex];
      if (!other) continue;
      if (
        distanceInMeters(
          current.latitude,
          current.longitude,
          other.latitude,
          other.longitude
        ) > meters
      ) {
        continue;
      }
      current.avatars.push(...other.avatars);
      current.latitude =
        (current.latitude * current.count + other.latitude * other.count) /
        (current.count + other.count);
      current.longitude =
        (current.longitude * current.count + other.longitude * other.count) /
        (current.count + other.count);
      current.count = current.avatars.length;
      current.id = current.avatars.map(avatarIdOf).filter(Boolean).join('|');
      remaining[otherIndex] = null;
    }
  }
  return remaining.filter(Boolean);
}

/**
 * Globe HTML markers for the current camera distance.
 *
 * Pins that would land on the same screen point stay one place with a count.
 * Named pins are not fanned here — overlapping names are illegible. Click the
 * number to open the list of avatars in that place.
 *
 * @param {Array<Object>|null|undefined} avatars
 * @param {number} groupingDegrees
 * @returns {Array<Object>}
 */
export function globeMarkerGroups(avatars, groupingDegrees) {
  const requested = Number(groupingDegrees);
  const cell = Number.isFinite(requested) && requested > 0 ? requested : 0.8;
  const visualCell = Math.max(cell, GLOBE_VISUAL_GROUPING_DEGREES);
  return mergeGroupsWithinDegrees(clusterPins(avatars, visualCell), visualCell);
}

/**
 * Leaflet cannot draw two markers on one point. Spread a stack into a small
 * ring so each avatar can be clicked, while the true pin stays on the avatar.
 *
 * @param {Array<Object>|null|undefined} avatars
 * @param {number} [radiusMeters]
 * @returns {Map<string, {latitude: number, longitude: number}>}
 */
/**
 * Fan every avatar in a visual cluster around the cluster centre.
 *
 * Unlike {@link spreadStackedPinPositions}, this does not require the pins to
 * share a doorway key — two people a block apart still need separate globe
 * HTML markers after a fly-in.
 *
 * @param {Array<Object>|null|undefined} avatars
 * @param {number} [radiusMeters]
 * @returns {Map<string, {latitude: number, longitude: number}>}
 */
export function spreadGroupPinPositions(avatars, radiusMeters = 80) {
  const entries = [];
  for (const avatar of avatars ?? []) {
    const pin = pinOf(avatar);
    const id = avatarIdOf(avatar);
    if (!pin || !id) continue;
    entries.push({ id, pin });
  }
  const byId = new Map();
  if (entries.length === 0) return byId;
  if (entries.length === 1) {
    byId.set(entries[0].id, {
      latitude: Number(entries[0].pin.latitude),
      longitude: Number(entries[0].pin.longitude),
    });
    return byId;
  }
  const latitude =
    entries.reduce((sum, entry) => sum + Number(entry.pin.latitude), 0) /
    entries.length;
  const longitude =
    entries.reduce((sum, entry) => sum + Number(entry.pin.longitude), 0) /
    entries.length;
  const metersToDegrees = radiusMeters / 111320;
  entries.forEach((entry, index) => {
    const angle = (2 * Math.PI * index) / entries.length - Math.PI / 2;
    const latitudeOffset = metersToDegrees * Math.cos(angle);
    const longitudeOffset =
      (metersToDegrees * Math.sin(angle)) /
      Math.max(Math.cos((latitude * Math.PI) / 180), 0.2);
    byId.set(entry.id, {
      latitude: latitude + latitudeOffset,
      longitude: longitude + longitudeOffset,
    });
  });
  return byId;
}

export function spreadStackedPinPositions(avatars, radiusMeters = 10) {
  const groups = new Map();
  for (const avatar of avatars ?? []) {
    const pin = pinOf(avatar);
    const id = mapKeyOf(avatar);
    if (!pin || !id) continue;
    const key = samePlaceKey(pin.latitude, pin.longitude);
    const group = groups.get(key) ?? [];
    group.push({ id, pin });
    groups.set(key, group);
  }
  const byId = new Map();
  for (const group of groups.values()) {
    if (group.length === 1) {
      const { id, pin } = group[0];
      byId.set(id, {
        latitude: Number(pin.latitude),
        longitude: Number(pin.longitude),
      });
      continue;
    }
    const metersToDegrees = radiusMeters / 111320;
    group.forEach((entry, index) => {
      const angle = (2 * Math.PI * index) / group.length - Math.PI / 2;
      const latitude = Number(entry.pin.latitude);
      const longitude = Number(entry.pin.longitude);
      const latitudeOffset = metersToDegrees * Math.cos(angle);
      const longitudeOffset =
        (metersToDegrees * Math.sin(angle)) /
        Math.max(Math.cos((latitude * Math.PI) / 180), 0.2);
      byId.set(entry.id, {
        latitude: latitude + latitudeOffset,
        longitude: longitude + longitudeOffset,
      });
    });
  }
  return byId;
}
