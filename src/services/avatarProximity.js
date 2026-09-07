// src/services/avatarProximity.js
//
// The pure geometry and shaping behind geo-located avatars: turning a pin the
// user edited into the query parameters /create_avatar and /modify_avatar
// expect, turning a map viewport into the bounding box /avatars/geo expects,
// measuring how far away a pin is, and grouping pins that would otherwise land
// on top of each other on a zoomed-out globe.
//
// No JSX and no import.meta.env, so the Node test runner can import this file.

export const DEFAULT_GEOFENCE_RADIUS_METERS = 50;
export const MINIMUM_GEOFENCE_RADIUS_METERS = 5;
export const MAXIMUM_GEOFENCE_RADIUS_METERS = 5000;

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
 * @returns {number} A whole number of meters.
 */
export function clampGeofenceRadius(radiusMeters) {
  const radius = Number(radiusMeters);
  if (!Number.isFinite(radius)) return DEFAULT_GEOFENCE_RADIUS_METERS;
  return Math.min(
    MAXIMUM_GEOFENCE_RADIUS_METERS,
    Math.max(MINIMUM_GEOFENCE_RADIUS_METERS, Math.round(radius))
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
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`;
}

/**
 * The pin carried by an avatar record, from either shape the API returns.
 *
 * The creator's own record keeps the pin inside the metadata; a public listing
 * lifts the pin to the top level and drops the metadata entirely.
 *
 * @param {Object|null|undefined} avatar
 * @returns {Object|null} The geo_location block, or null when unpinned.
 */
export function pinOf(avatar) {
  if (!avatar) return null;
  const pin = avatar?.metadata?.geo_location ?? avatar?.geo_location ?? null;
  if (!pin) return null;
  if (!isValidCoordinate(Number(pin.latitude), Number(pin.longitude))) return null;
  return pin;
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
    latitude: group.latitudeSum / group.avatars.length,
    longitude: group.longitudeSum / group.avatars.length,
    avatars: group.avatars,
    count: group.avatars.length,
  }));
}
