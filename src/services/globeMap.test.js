import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  GLOBE_HTML_MARKER_ALTITUDE,
  GLOBE_HTML_TRANSITION_MS,
  GLOBE_MIN_DISTANCE_OVER_RADIUS,
  GLOBE_PLACE_FLY_ALTITUDE,
  WHOLE_WORLD_ALTITUDE,
  WORLD_GLOBE_ATMOSPHERE_ALTITUDE,
  WORLD_GLOBE_ATMOSPHERE_COLOR,
  WORLD_GLOBE_ATMOSPHERE_RGB,
  WORLD_GLOBE_BACKGROUND_COLOR,
  globeMinDistance,
  initialWorldMapView,
  slippyTileUrl,
  wholeWorldMapViewFrom,
  worldGlobeAutoRotateEnabled,
} from './globeMap.js';

const OSM = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ESRI =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

test('a Leaflet OSM template keeps x before y and fills the subdomain', () => {
  assert.equal(
    slippyTileUrl(OSM, 1, 2, 3),
    'https://a.tile.openstreetmap.org/3/1/2.png'
  );
});

test('an Esri template keeps y before x so imagery is not axis-swapped', () => {
  assert.equal(
    slippyTileUrl(ESRI, 4, 5, 6),
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/6/5/4'
  );
});

test('a missing or non-numeric tile request does not invent a URL', () => {
  assert.equal(slippyTileUrl('', 1, 2, 3), '');
  assert.equal(slippyTileUrl(OSM, Number.NaN, 2, 3), '');
});

test('the whole-world camera sits far enough to see the planet', () => {
  assert.equal(WHOLE_WORLD_ALTITUDE, 2.4);
});

test('targeting the map opens at Reset world view, not the device or first pin', () => {
  assert.deepEqual(initialWorldMapView(), {
    worldViewRevision: 1,
    isMinimapOpen: false,
    mapFocus: null,
  });
  assert.deepEqual(wholeWorldMapViewFrom(1), {
    worldViewRevision: 2,
    isMinimapOpen: false,
    mapFocus: null,
  });
});

test('the shared globe keeps an opaque sky so the atmosphere glow composites', () => {
  assert.equal(WORLD_GLOBE_BACKGROUND_COLOR, '#000000');
  assert.equal(WORLD_GLOBE_ATMOSPHERE_COLOR, 'lightskyblue');
  assert.equal(WORLD_GLOBE_ATMOSPHERE_RGB, '135, 206, 250');
  assert.equal(WORLD_GLOBE_ATMOSPHERE_ALTITUDE, 0.15);
});

test('the globe only drifts when nothing is selected or hovered', () => {
  assert.equal(worldGlobeAutoRotateEnabled(), true);
  assert.equal(
    worldGlobeAutoRotateEnabled({ prefersReducedMotion: true }),
    false
  );
  assert.equal(
    worldGlobeAutoRotateEnabled({ hasFocusedPlace: true }),
    false
  );
  assert.equal(worldGlobeAutoRotateEnabled({ isHovered: true }), false);
  assert.equal(
    worldGlobeAutoRotateEnabled({
      hasFocusedPlace: true,
      isHovered: false,
    }),
    false
  );
});

test('globe pins sit on the surface and do not animate off the doorway', () => {
  assert.equal(GLOBE_HTML_MARKER_ALTITUDE, 0);
  assert.equal(GLOBE_HTML_TRANSITION_MS, 0);
  assert.ok(GLOBE_PLACE_FLY_ALTITUDE < 0.08);
  assert.ok(GLOBE_MIN_DISTANCE_OVER_RADIUS < 0.004);
  assert.equal(globeMinDistance(100), 100 * (1 + GLOBE_MIN_DISTANCE_OVER_RADIUS));
});
