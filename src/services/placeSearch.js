// src/services/placeSearch.js
//
// Finding a place on the pin picker's map from what a person typed: either a
// pair of coordinates they have written down ("44.98, -93.26") or the name of
// somewhere ("Stone Arch Bridge, Minneapolis"), which a geocoder turns into
// coordinates.
//
// The geocoder is deployment configuration (see config/maps.js); this module
// takes the endpoint as an argument so the Node test runner can import it.
// The default is Nominatim, whose usage policy allows one request per second
// and no autocomplete, so a search runs when the person asks for it, never on
// every keystroke.
//
// No JSX and no import.meta.env, so the Node test runner can import this file.

import { isValidCoordinate } from './avatarProximity.js';

export const DEFAULT_PLACE_RESULT_LIMIT = 5;

// A number as a person types it: an optional sign, digits, an optional
// fraction. "-", "-.", "9." and "-0." are all on the way to a number.
const PARTIAL_DECIMAL_PATTERN = /^[+-]?(\d+\.?\d*|\.\d*)?$/;
const COMPLETE_DECIMAL_PATTERN = /^[+-]?(\d+\.?\d*|\.\d+)$/;

/**
 * Whether the text could still become a decimal number if typing continued.
 *
 * Used to let a coordinate field hold "-" or "44." without either rejecting
 * the keystroke or turning it into NaN.
 *
 * @param {string} text
 * @returns {boolean}
 */
export function isPartialDecimal(text) {
  return PARTIAL_DECIMAL_PATTERN.test(String(text ?? '').trim());
}

/**
 * The number a coordinate field holds, or null while it is blank or unfinished.
 *
 * @param {string} text
 * @returns {number|null}
 */
export function parseDecimal(text) {
  const trimmed = String(text ?? '').trim();
  if (!COMPLETE_DECIMAL_PATTERN.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * The coordinate pair a search box holds, if that is what was typed.
 *
 * Accepts "lat, lon", "lat lon" and "lat; lon", with either or both negative.
 * Anything that is not two finite numbers on Earth is not a coordinate pair,
 * and the text should go to the geocoder instead.
 *
 * @param {string} text
 * @returns {{latitude: number, longitude: number}|null}
 */
export function parseCoordinatePair(text) {
  const parts = String(text ?? '')
    .trim()
    .split(/\s*[,;]\s*|\s+/)
    .filter(Boolean);
  if (parts.length !== 2) return null;
  const latitude = parseDecimal(parts[0]);
  const longitude = parseDecimal(parts[1]);
  if (latitude === null || longitude === null) return null;
  if (!isValidCoordinate(latitude, longitude)) return null;
  return { latitude, longitude };
}

/**
 * The URL that asks the geocoder about a place name.
 *
 * @param {string} endpoint The geocoder's search endpoint.
 * @param {string} query What the person typed.
 * @param {Object} [options]
 * @param {number} [options.limit] How many results to ask for.
 * @returns {string}
 */
export function placeSearchUrl(endpoint, query, { limit = DEFAULT_PLACE_RESULT_LIMIT } = {}) {
  const url = new URL(endpoint);
  url.searchParams.set('q', query.trim());
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('addressdetails', '0');
  return url.toString();
}

/**
 * The short name a result goes by: the first part of its display name, which
 * for Nominatim is the place itself before the address trail.
 *
 * @param {Object} result
 * @returns {string}
 */
function shortNameOf(result) {
  const name = String(result?.name ?? '').trim();
  if (name) return name;
  return String(result?.display_name ?? '')
    .split(',')[0]
    .trim();
}

/**
 * Turn a geocoder response into the places the picker offers.
 *
 * Results without a usable coordinate are dropped rather than shown, because a
 * result that cannot be placed would leave the pin where it was.
 *
 * @param {unknown} payload The parsed JSON the geocoder returned.
 * @returns {Array<{id: string, name: string, description: string, latitude: number, longitude: number}>}
 */
export function placesFromResponse(payload) {
  if (!Array.isArray(payload)) return [];
  const places = [];
  for (const result of payload) {
    const latitude = Number(result?.lat);
    const longitude = Number(result?.lon);
    if (!isValidCoordinate(latitude, longitude)) continue;
    const name = shortNameOf(result);
    const description = String(result?.display_name ?? '').trim();
    places.push({
      id: String(result?.place_id ?? `${latitude},${longitude}`),
      name: name || description || `${latitude}, ${longitude}`,
      description,
      latitude,
      longitude,
    });
  }
  return places;
}

/**
 * Ask the geocoder where a place is.
 *
 * @param {string} endpoint The geocoder's search endpoint.
 * @param {string} query What the person typed.
 * @param {Object} [options]
 * @param {AbortSignal} [options.signal]
 * @param {number} [options.limit]
 * @param {typeof fetch} [options.fetchImplementation]
 * @returns {Promise<Array<{id: string, name: string, description: string, latitude: number, longitude: number}>>}
 */
export async function searchPlaces(
  endpoint,
  query,
  { signal, limit, fetchImplementation = globalThis.fetch } = {}
) {
  const trimmed = String(query ?? '').trim();
  if (!trimmed) return [];
  const response = await fetchImplementation(placeSearchUrl(endpoint, trimmed, { limit }), {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    const error = new Error(`Place search failed with status ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return placesFromResponse(await response.json());
}

/**
 * The sentence to show when a place search could not be completed.
 *
 * @param {Error|null} error
 * @returns {string}
 */
export function describePlaceSearchError(error) {
  if (!error) return '';
  if (error.status === 429) {
    return 'The place search is busy. Wait a moment and try again.';
  }
  return 'The place search could not be reached. Check your connection and try again.';
}
