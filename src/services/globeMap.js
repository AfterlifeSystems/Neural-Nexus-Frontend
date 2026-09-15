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

// Camera altitude at which the whole planet fits on screen. The page
// background and the map's "Reset world view" both sit here.
export const WHOLE_WORLD_ALTITUDE = 2.4;

/**
 * Opening `/map` is the same camera as pressing Reset world view: whole
 * planet, street inset folded, nothing selected. Device GPS and the first
 * pin wait until the person chooses a place.
 *
 * `worldViewRevision` starts at 1 so the globe's reset effect runs as soon
 * as the WebGL world is ready (`0` is "never asked").
 *
 * @returns {{worldViewRevision: number, isMinimapOpen: boolean, mapFocus: null}}
 */
export function initialWorldMapView() {
  return {
    worldViewRevision: 1,
    isMinimapOpen: false,
    mapFocus: null,
  };
}

/**
 * The next Reset world view: fold the street inset, drop the selected
 * place, and bump the revision so the globe flies back out.
 *
 * @param {number} [worldViewRevision]
 * @returns {{worldViewRevision: number, isMinimapOpen: boolean, mapFocus: null}}
 */
export function wholeWorldMapViewFrom(worldViewRevision = 0) {
  return {
    worldViewRevision: Number(worldViewRevision) + 1,
    isMinimapOpen: false,
    mapFocus: null,
  };
}

// Slow drift of the idle whole-world camera, shared by the page background
// and the map globe.
export const WORLD_GLOBE_AUTO_ROTATE_SPEED = 0.35;

/**
 * Idle drift is the whole-world camera. A selected avatar with a pin, a
 * selected map place, or a hover must hold still. Selecting an avatar
 * that has no location leaves the planet spinning.
 *
 * @param {{prefersReducedMotion?: boolean, hasFocusedPlace?: boolean, isHovered?: boolean}} [options]
 * @returns {boolean}
 */
export function worldGlobeAutoRotateEnabled({
  prefersReducedMotion = false,
  hasFocusedPlace = false,
  isHovered = false,
} = {}) {
  return !prefersReducedMotion && !hasFocusedPlace && !isHovered;
}

// Opaque black so the atmosphere glow composites against the framebuffer.
// A transparent canvas makes globe.gl's GlowMesh (alpha in the fragment)
// disappear into the page.
export const WORLD_GLOBE_BACKGROUND_COLOR = '#000000';

// globe.gl's own halo: light sky blue, 15% of the globe radius. 0.07 of a
// muted navy sat on the tiles and read as a missing atmosphere. The RGB
// channels are the CSS named colour; `--world-atmosphere-rgb` in index.css
// must stay in lockstep so the talk pulse matches. The standing portrait
// hairline is gallery glass, not this colour.
export const WORLD_GLOBE_ATMOSPHERE_COLOR = 'lightskyblue';
export const WORLD_GLOBE_ATMOSPHERE_RGB = '135, 206, 250';
export const WORLD_GLOBE_ATMOSPHERE_ALTITUDE = 0.15;

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
