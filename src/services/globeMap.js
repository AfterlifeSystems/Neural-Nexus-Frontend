// src/services/globeMap.js
//
// Pure helpers for the spinning globe: turn a Leaflet-style tile template into
// the (x, y, zoom) callback globe.gl's slippy engine calls, and keep the camera
// and HTML pins on the surface so a sharp map and the icons agree.
//
// No JSX and no import.meta.env, so the Node test runner can import this file.

// HTML pins used to sit at 0.012 globe radii (~76 km). CSS2D then projected
// that hover-point beside the city on the texture. Sit on the surface.
export const GLOBE_HTML_MARKER_ALTITUDE = 0;

// globe.gl defaults this to 1000 ms, so a cluster update slides the pin off
// the doorway it just landed on.
export const GLOBE_HTML_TRANSITION_MS = 0;

// Camera altitude (globe radii) when flying to one place. 0.08 was ~510 km
// and still showed the old 4K texture as a handful of pixels per city.
export const GLOBE_PLACE_FLY_ALTITUDE = 0.03;

// Closest the camera may sit, as a fraction of the globe radius above the
// surface. 0.004 (the old minDistance 100.4) stopped the zoom at ~25 km.
export const GLOBE_MIN_DISTANCE_OVER_RADIUS = 0.0008;

export const GLOBE_TILE_MAX_ZOOM = 19;

/**
 * Fill a Leaflet-style `{s}/{z}/{x}/{y}` (or Esri `{z}/{y}/{x}`) template.
 *
 * Replacing `{x}` and `{y}` independently keeps Esri's y-before-x order from
 * swapping axes — that swap is how a sharp map ends up with pins in the sea.
 *
 * @param {string} template
 * @param {number} tileX
 * @param {number} tileY
 * @param {number} zoomLevel
 * @param {string} [subdomains]
 * @returns {string}
 */
export function slippyTileUrl(
  template,
  tileX,
  tileY,
  zoomLevel,
  subdomains = 'abc'
) {
  if (!template) return '';
  const pool = subdomains && subdomains.length ? subdomains : 'abc';
  const x = Number(tileX);
  const y = Number(tileY);
  const zoom = Number(zoomLevel);
  if (![x, y, zoom].every(Number.isFinite)) return '';
  const subdomain = pool[Math.abs(Math.trunc(x) + Math.trunc(y)) % pool.length];
  return String(template)
    .replaceAll('{s}', subdomain)
    .replaceAll('{z}', String(Math.trunc(zoom)))
    .replaceAll('{x}', String(Math.trunc(x)))
    .replaceAll('{y}', String(Math.trunc(y)))
    .replaceAll('{r}', '');
}

/**
 * How close OrbitControls may approach the globe centre.
 *
 * @param {number} globeRadius
 * @returns {number}
 */
export function globeMinDistance(globeRadius) {
  const radius = Number(globeRadius);
  const safeRadius = Number.isFinite(radius) && radius > 0 ? radius : 100;
  return safeRadius * (1 + GLOBE_MIN_DISTANCE_OVER_RADIUS);
}
