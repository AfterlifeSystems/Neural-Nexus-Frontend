import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  GLOBE_HTML_MARKER_ALTITUDE,
  GLOBE_HTML_TRANSITION_MS,
  GLOBE_MIN_DISTANCE_OVER_RADIUS,
  GLOBE_PLACE_FLY_ALTITUDE,
  globeMinDistance,
  slippyTileUrl,
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

test('globe pins sit on the surface and do not animate off the doorway', () => {
  assert.equal(GLOBE_HTML_MARKER_ALTITUDE, 0);
  assert.equal(GLOBE_HTML_TRANSITION_MS, 0);
  assert.ok(GLOBE_PLACE_FLY_ALTITUDE < 0.08);
  assert.ok(GLOBE_MIN_DISTANCE_OVER_RADIUS < 0.004);
  assert.equal(globeMinDistance(100), 100 * (1 + GLOBE_MIN_DISTANCE_OVER_RADIUS));
});
