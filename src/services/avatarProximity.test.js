import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_GEOFENCE_RADIUS_METERS,
  MAXIMUM_ARRIVAL_ACCURACY_METERS,
  DOORWAY_GEOFENCE_RADIUS_METERS,
  MINIMUM_GEOFENCE_RADIUS_METERS,
  PIN_COORDINATE_DIGITS,
  STREET_LEVEL_GROUPING_DEGREES,
  avatarIdOf,
  avatarsFromResponse,
  avatarsWithinMeters,
  boundsQuery,
  cappedAccuracyMeters,
  clampGeofenceRadius,
  clusterPins,
  describeDistance,
  describeGeofenceRadius,
  distanceInMeters,
  formatCoordinate,
  formatRadiusUnitValue,
  geoLocationQuery,
  globeClusterDegreesForAltitude,
  globeMarkerGroups,
  globePointRadius,
  groupingDegreesForAltitude,
  mapKeyOf,
  isInsideGeofence,
  isValidCoordinate,
  avatarsAtSamePlace,
  avatarsInFocusGroup,
  groupIdsForFocus,
  mergePinnedAvatars,
  metersFromRadiusUnit,
  pinCoordinate,
  samePlaceKey,
  spreadGroupPinPositions,
  spreadStackedPinPositions,
  pinOf,
  refineNearbyAvatars,
  withPin,
  withoutPin,
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
  assert.equal(DEFAULT_GEOFENCE_RADIUS_METERS, 1);
  assert.equal(MINIMUM_GEOFENCE_RADIUS_METERS, 1);
  assert.equal(DOORWAY_GEOFENCE_RADIUS_METERS, 1);
  assert.equal(clampGeofenceRadius(undefined), 1);
  assert.equal(clampGeofenceRadius('120'), 120);
  assert.equal(clampGeofenceRadius(1), 1);
  assert.equal(clampGeofenceRadius(0.4), 1);
  assert.equal(clampGeofenceRadius(999999), 5000);
});

test('a one-metre doorway can be typed in miles without snapping to 0.10 mi', () => {
  assert.equal(formatRadiusUnitValue(1, 'mi'), '0.000621');
  assert.equal(formatRadiusUnitValue(1, 'yd'), '1.09');
  assert.equal(formatRadiusUnitValue(1, 'km'), '0.001');
  assert.equal(metersFromRadiusUnit(0.000621, 'mi'), 1);
  assert.ok(metersFromRadiusUnit(0.1, 'mi') > 160);
});

test('no unit can send a radius below the API minimum', () => {
  assert.equal(metersFromRadiusUnit(0.001, 'm'), 1);
  assert.equal(metersFromRadiusUnit(0.0001, 'km'), 1);
  assert.equal(metersFromRadiusUnit(0.5, 'yd'), 1);
  assert.equal(metersFromRadiusUnit(0.0001, 'mi'), 1);
  assert.equal(geoLocationQuery({
    latitude: 44.98,
    longitude: -93.25,
    geofenceRadiusMeters: 0.2,
  }).geofence_radius_meters, 1);
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
  assert.equal(describeDistance(0.4), '0.4 m');
  assert.equal(describeDistance(1), '1 m');
  assert.equal(describeDistance(1609.344), '1.0 mi (1609 m)');
  assert.equal(describeDistance(45000), '28 mi (45000 m)');
  assert.equal(describeDistance(null), '');
  assert.equal(describeDistance(-5), '');
  assert.equal(describeGeofenceRadius(1), '1 m');
  assert.equal(describeGeofenceRadius(0.4), '1 m');
  assert.equal(describeGeofenceRadius(1609.344), '1.609 km');
});

test('the pin is read from the owner record and from a public listing alike', () => {
  const pin = { latitude: 44.9809, longitude: -93.2533, geofence_radius_meters: 50 };
  assert.deepEqual(pinOf({ metadata: { geo_location: pin } }), pin);
  assert.deepEqual(pinOf({ geo_location: pin }), pin);
  assert.equal(pinOf({ metadata: {} }), null);
  assert.equal(pinOf(null), null);
  assert.equal(pinOf({ geo_location: { latitude: 999, longitude: 0 } }), null);
  assert.deepEqual(
    pinOf({ assistant_id: 'flat', latitude: 44.9809, longitude: -93.2533 }),
    { latitude: 44.9809, longitude: -93.2533 }
  );
  assert.deepEqual(
    pinOf({ lat: 44.9809, lng: -93.2533, locationName: 'Bridge' }),
    { latitude: 44.9809, longitude: -93.2533, location_name: 'Bridge' }
  );
  assert.equal(pinOf({ geo_location: { latitude: '', longitude: '' } }), null);
  assert.deepEqual(
    pinOf({
      geo_location: { type: 'Point', coordinates: [-93.2533, 44.9809] },
    }),
    { latitude: 44.9809, longitude: -93.2533 }
  );
  assert.deepEqual(
    pinOf({ metadata: { latitude: 44.9809, longitude: -93.2533 } }),
    { latitude: 44.9809, longitude: -93.2533 }
  );
});

test('a geo listing is read from a bare array or an avatars wrapper', () => {
  const one = { assistant_id: 'bridge', geo_location: BRIDGE };
  assert.deepEqual(avatarsFromResponse([one]), [one]);
  assert.deepEqual(avatarsFromResponse({ avatars: [one] }), [one]);
  assert.deepEqual(avatarsFromResponse({ items: [one] }), [one]);
  assert.deepEqual(avatarsFromResponse(null), []);
  assert.deepEqual(avatarsFromResponse({}), []);
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

test('a pin is written onto both record shapes so a later read sees it', () => {
  const placed = withPin(
    { assistant_id: 'bridge', metadata: { user_id: 'u1' } },
    { latitude: 44.9809, longitude: -93.2533 }
  );
  assert.equal(placed.geo_location.latitude, 44.9809);
  assert.equal(placed.metadata.geo_location.latitude, 44.9809);
  assert.equal(placed.metadata.user_id, 'u1');
  assert.equal(pinOf(withoutPin(placed)), null);
  assert.equal(avatarIdOf({ avatar_id: 'only-this' }), 'only-this');
  assert.equal(avatarIdOf({ metadata: { assistant_id: 'from-meta' } }), 'from-meta');
  assert.equal(avatarIdOf({ id: 'flat-id' }), null);
  assert.equal(avatarIdOf({ assistant_id: 'a', id: 'other' }), 'a');
});

test('owned private pins join the public globe listing', () => {
  const publicAvatars = [
    { assistant_id: 'bridge', name: 'Bridge', geo_location: BRIDGE },
  ];
  const ownedAvatars = [
    {
      assistant_id: 'private-shop',
      name: 'Shop',
      metadata: { geo_location: NEAR_BRIDGE, is_public: false, user_id: 'u1' },
    },
    { assistant_id: 'bridge', name: 'Bridge (mine)', metadata: { geo_location: BRIDGE } },
    { assistant_id: 'unpinned', name: 'No place' },
  ];
  const merged = mergePinnedAvatars(publicAvatars, ownedAvatars);
  assert.equal(merged.length, 2);
  assert.ok(merged.some((avatar) => avatar.assistant_id === 'private-shop'));
  const bridge = merged.find((avatar) => avatar.assistant_id === 'bridge');
  assert.equal(bridge.name, 'Bridge (mine)');
  assert.ok(pinOf(bridge));
});

test('standing one metre from the pin counts as arriving', () => {
  assert.equal(
    isInsideGeofence({
      distanceMeters: 0.4,
      radiusMeters: DOORWAY_GEOFENCE_RADIUS_METERS,
    }),
    true
  );
  assert.equal(
    isInsideGeofence({
      distanceMeters: 1.2,
      radiusMeters: DOORWAY_GEOFENCE_RADIUS_METERS,
    }),
    false
  );
});

test('a kilometres-wide accuracy reading cannot count as standing at a doorway', () => {
  assert.equal(
    isInsideGeofence({ distanceMeters: 4, radiusMeters: 6, accuracyMeters: 8 }),
    true
  );
  assert.equal(
    isInsideGeofence({
      distanceMeters: 20,
      radiusMeters: 6,
      accuracyMeters: 8000,
    }),
    false
  );
  assert.ok(8000 > MAXIMUM_ARRIVAL_ACCURACY_METERS);
  assert.equal(cappedAccuracyMeters(8000), 15);
  assert.equal(cappedAccuracyMeters(-1), undefined);
});

test('nearby entries are refined so a coarse API inside-flag is not trusted', () => {
  const [refined] = refineNearbyAvatars(
    [
      {
        assistant_id: 'bridge',
        geo_location: { ...BRIDGE, geofence_radius_meters: 6 },
        distance_meters: 12,
        inside_geofence: true,
      },
    ],
    { latitude: BRIDGE.latitude, longitude: BRIDGE.longitude, accuracyMeters: 8000 }
  );
  assert.equal(refined.inside_geofence, false);
});

test('the globe groups down to about six metres when the camera is close', () => {
  assert.equal(groupingDegreesForAltitude(2), 1.2);
  assert.ok(groupingDegreesForAltitude(2) < 5);
  assert.equal(groupingDegreesForAltitude(0.002), STREET_LEVEL_GROUPING_DEGREES);
  assert.ok(globePointRadius(0.01, 1) < globePointRadius(1, 1));
  assert.equal(PIN_COORDINATE_DIGITS, 7);
  assert.equal(formatCoordinate(44.9809012), '44.9809012');
  assert.equal(pinCoordinate(44.980901234), 44.9809012);
});

test('avatars on the same doorway stay one place and spread on the street map', () => {
  const stacked = [
    { assistant_id: 'a', name: 'A', geo_location: BRIDGE },
    { assistant_id: 'b', name: 'B', geo_location: { ...BRIDGE } },
    { assistant_id: 'c', name: 'C', geo_location: CATHEDRAL },
  ];
  assert.equal(samePlaceKey(BRIDGE.latitude, BRIDGE.longitude), samePlaceKey(44.9809, -93.2533));
  assert.equal(avatarsAtSamePlace(stacked, BRIDGE.latitude, BRIDGE.longitude).length, 2);
  const spread = spreadStackedPinPositions(stacked);
  const first = spread.get('a');
  const second = spread.get('b');
  const alone = spread.get('c');
  assert.ok(first && second && alone);
  assert.notEqual(
    `${first.latitude},${first.longitude}`,
    `${second.latitude},${second.longitude}`
  );
  assert.equal(alone.latitude, CATHEDRAL.latitude);
  assert.equal(alone.longitude, CATHEDRAL.longitude);
});

test('a pin without an assistant id is not dropped from the map', () => {
  const merged = mergePinnedAvatars(
    [{ assistant_id: 'jeff', name: 'Uncle Jeff', geo_location: BRIDGE }],
    [{ name: 'Thomas Woods', metadata: { geo_location: NEAR_BRIDGE } }]
  );
  assert.equal(merged.length, 2);
  assert.ok(merged.some((avatar) => avatar.name === 'Thomas Woods'));
});

test('two people in the same place both stay on the merged globe list', () => {
  const merged = mergePinnedAvatars(
    [
      {
        assistant_id: 'jeff',
        name: 'Uncle Jeff',
        geo_location: BRIDGE,
      },
    ],
    [
      {
        assistant_id: 'thomas',
        name: 'Thomas Woods',
        metadata: { geo_location: { ...BRIDGE } },
      },
    ]
  );
  assert.equal(merged.length, 2);
  assert.ok(merged.some((avatar) => avatar.name === 'Uncle Jeff'));
  assert.ok(merged.some((avatar) => avatar.name === 'Thomas Woods'));
});

test('stacked globe pins stay one numbered group and keep every avatar', () => {
  const stacked = [
    { assistant_id: 'jeff', name: 'Uncle Jeff', geo_location: BRIDGE },
    { assistant_id: 'thomas', name: 'Thomas Woods', geo_location: BRIDGE },
    { name: 'Shop', geo_location: CATHEDRAL },
  ];
  const far = globeMarkerGroups(stacked, 1.2);
  assert.equal(
    far.reduce((count, group) => count + group.avatars.length, 0),
    3
  );
  const sameDoor = globeMarkerGroups(stacked.slice(0, 2), 0.002);
  assert.equal(sameDoor.length, 1);
  assert.equal(sameDoor[0].count, 2);
  assert.deepEqual(
    sameDoor[0].avatars.map((avatar) => avatar.name).sort(),
    ['Thomas Woods', 'Uncle Jeff']
  );
  assert.ok(globeClusterDegreesForAltitude(0.08) >= 0.008);
  assert.equal(mapKeyOf({ name: 'Shop', geo_location: CATHEDRAL }), 'Shop:44.9469:-93.1089');
});

test('a globe cluster stays a clickable group when one avatar is chosen', () => {
  const cluster = [
    { assistant_id: 'a', geo_location: BRIDGE },
    { assistant_id: 'b', geo_location: CATHEDRAL },
  ];
  const opened = groupIdsForFocus({ avatars: cluster });
  assert.deepEqual(opened, ['a', 'b']);
  assert.deepEqual(
    groupIdsForFocus({ assistantId: 'b', preserveGroup: true }, { groupIds: opened }),
    ['a', 'b']
  );
  assert.deepEqual(avatarsInFocusGroup(cluster, ['b', 'a']).map(avatarIdOf), [
    'b',
    'a',
  ]);
});
