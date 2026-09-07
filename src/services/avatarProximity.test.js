import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  boundsQuery,
  clampGeofenceRadius,
  clusterPins,
  describeDistance,
  distanceInMeters,
  geoLocationQuery,
  isValidCoordinate,
  pinOf,
} from './avatarProximity.js';

// Minneapolis Stone Arch Bridge and a point about 120 m east of the bridge.
const BRIDGE = { latitude: 44.9809, longitude: -93.2533 };
const NEAR_BRIDGE = { latitude: 44.9809, longitude: -93.2518 };
// Saint Paul cathedral, about 14 km away.
const CATHEDRAL = { latitude: 44.9469, longitude: -93.1089 };

test('a coordinate must name a real point on Earth', () => {
  assert.equal(isValidCoordinate(44.98, -93.25), true);
  assert.equal(isValidCoordinate(91, 0), false);
  assert.equal(isValidCoordinate(0, 181), false);
  assert.equal(isValidCoordinate(Number.NaN, 0), false);
  assert.equal(isValidCoordinate('44.98', -93.25), false);
});

test('a geofence radius is clamped to the range the API accepts', () => {
  assert.equal(clampGeofenceRadius(undefined), 50);
  assert.equal(clampGeofenceRadius('120'), 120);
  assert.equal(clampGeofenceRadius(1), 5);
  assert.equal(clampGeofenceRadius(999999), 5000);
});

test('a pin becomes snake-case query parameters, and nothing when incomplete', () => {
  assert.deepEqual(
    geoLocationQuery({
      ...BRIDGE,
      locationName: '  Stone Arch Bridge  ',
      geofenceRadiusMeters: 120,
    }),
    {
      latitude: 44.9809,
      longitude: -93.2533,
      location_name: 'Stone Arch Bridge',
      geofence_radius_meters: 120,
    }
  );
  // An empty place name is left out rather than sent blank.
  assert.deepEqual(geoLocationQuery({ ...BRIDGE, locationName: '   ' }), {
    latitude: 44.9809,
    longitude: -93.2533,
  });
  // An avatar with no place sends no geo parameters at all, so the API leaves
  // any existing pin alone.
  assert.deepEqual(geoLocationQuery(null), {});
  assert.deepEqual(geoLocationQuery({ latitude: 44.98 }), {});
  assert.deepEqual(geoLocationQuery({ latitude: 91, longitude: 0 }), {});
});

test('a map viewport becomes a bounding box, open on any side it omits', () => {
  assert.deepEqual(
    boundsQuery({
      minLatitude: 44.9,
      minLongitude: -93.3,
      maxLatitude: 45,
      maxLongitude: -93.2,
    }),
    {
      min_latitude: 44.9,
      min_longitude: -93.3,
      max_latitude: 45,
      max_longitude: -93.2,
    }
  );
  assert.deepEqual(boundsQuery({ minLatitude: 44.9 }), { min_latitude: 44.9 });
  assert.deepEqual(boundsQuery(null), {});
  // A viewport dragged past the antimeridian keeps its inverted longitudes; the
  // API reads that as a wrap.
  assert.deepEqual(
    boundsQuery({ minLongitude: 170, maxLongitude: -170 }),
    { min_longitude: 170, max_longitude: -170 }
  );
});

test('distance is measured along the great circle', () => {
  assert.equal(
    distanceInMeters(BRIDGE.latitude, BRIDGE.longitude, BRIDGE.latitude, BRIDGE.longitude),
    0
  );
  const shortWalk = distanceInMeters(
    BRIDGE.latitude,
    BRIDGE.longitude,
    NEAR_BRIDGE.latitude,
    NEAR_BRIDGE.longitude
  );
  assert.ok(shortWalk > 100 && shortWalk < 140, `expected about 120 m, got ${shortWalk}`);
  const acrossTown = distanceInMeters(
    BRIDGE.latitude,
    BRIDGE.longitude,
    CATHEDRAL.latitude,
    CATHEDRAL.longitude
  );
  assert.ok(acrossTown > 11000 && acrossTown < 12500);
});

test('a distance is written the way a person reads one', () => {
  assert.equal(describeDistance(40), '40 m');
  assert.equal(describeDistance(999), '999 m');
  assert.equal(describeDistance(1200), '1.2 km');
  assert.equal(describeDistance(45000), '45 km');
  assert.equal(describeDistance(null), '');
  assert.equal(describeDistance(-5), '');
});

test('the pin is read from the owner record and from a public listing alike', () => {
  const pin = { latitude: 44.9809, longitude: -93.2533, geofence_radius_meters: 50 };
  assert.deepEqual(pinOf({ metadata: { geo_location: pin } }), pin);
  assert.deepEqual(pinOf({ geo_location: pin }), pin);
  assert.equal(pinOf({ metadata: {} }), null);
  assert.equal(pinOf(null), null);
  assert.equal(pinOf({ geo_location: { latitude: 999, longitude: 0 } }), null);
});

test('pins that would overlap on a spinning globe are grouped', () => {
  const avatars = [
    { assistant_id: 'bridge', geo_location: BRIDGE },
    { assistant_id: 'near-bridge', geo_location: NEAR_BRIDGE },
    { assistant_id: 'cathedral', geo_location: CATHEDRAL },
    { assistant_id: 'unpinned' },
  ];
  // At globe zoom the whole city is one group.
  const wide = clusterPins(avatars, 5);
  assert.equal(wide.length, 1);
  assert.equal(wide[0].count, 3);
  assert.ok(wide[0].latitude > 44 && wide[0].latitude < 45);

  // Zoomed to a city block, all three pins separate.
  const close = clusterPins(avatars, 0.001);
  assert.equal(close.length, 3);
  assert.deepEqual(
    close.map((group) => group.count),
    [1, 1, 1]
  );

  // At an intermediate grid the two bridge pins still share a cell while the
  // cathedral across town does not.
  const cityBlocks = clusterPins(avatars, 0.01);
  assert.deepEqual(
    cityBlocks.map((group) => group.count).sort(),
    [1, 2]
  );

  assert.deepEqual(clusterPins([], 5), []);
  assert.deepEqual(clusterPins(undefined, 5), []);
});
