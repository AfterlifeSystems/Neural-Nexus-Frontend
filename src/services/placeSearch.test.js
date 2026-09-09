import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  describePlaceSearchError,
  isPartialDecimal,
  parseCoordinatePair,
  parseDecimal,
  placeSearchUrl,
  placesFromResponse,
  searchPlaces,
} from './placeSearch.js';

const ENDPOINT = 'https://nominatim.example.org/search';

test('isPartialDecimal accepts a number while it is still being typed', () => {
  for (const text of ['', '-', '+', '.', '-.', '4', '-4', '44.', '-44.', '-0.', '-93.2650']) {
    assert.equal(isPartialDecimal(text), true, `expected "${text}" to be partial`);
  }
  for (const text of ['a', '-a', '4-', '4.4.', '1e5', '44,9', '--4']) {
    assert.equal(isPartialDecimal(text), false, `expected "${text}" to be rejected`);
  }
});

test('parseDecimal returns null for blank or unfinished text instead of NaN', () => {
  assert.equal(parseDecimal(''), null);
  assert.equal(parseDecimal('-'), null);
  assert.equal(parseDecimal('-.'), null);
  assert.equal(parseDecimal('abc'), null);
  assert.equal(parseDecimal('-93.2650'), -93.265);
  assert.equal(parseDecimal('44.'), 44);
  assert.equal(parseDecimal('-.5'), -0.5);
  assert.equal(parseDecimal(' 12.5 '), 12.5);
});

test('parseCoordinatePair reads negative decimal pairs in common shapes', () => {
  const expected = { latitude: 44.9812, longitude: -93.2565 };
  assert.deepEqual(parseCoordinatePair('44.9812, -93.2565'), expected);
  assert.deepEqual(parseCoordinatePair('44.9812,-93.2565'), expected);
  assert.deepEqual(parseCoordinatePair('44.9812 -93.2565'), expected);
  assert.deepEqual(parseCoordinatePair('44.9812; -93.2565'), expected);
  assert.deepEqual(parseCoordinatePair('-33.8688, 151.2093'), {
    latitude: -33.8688,
    longitude: 151.2093,
  });
});

test('parseCoordinatePair leaves place names and off-Earth numbers to the geocoder', () => {
  assert.equal(parseCoordinatePair('Stone Arch Bridge'), null);
  assert.equal(parseCoordinatePair('44.98'), null);
  assert.equal(parseCoordinatePair('44.98, -93.26, 12'), null);
  assert.equal(parseCoordinatePair('91, 0'), null);
  assert.equal(parseCoordinatePair('0, -181'), null);
  assert.equal(parseCoordinatePair('-, -'), null);
  assert.equal(parseCoordinatePair(''), null);
});

test('placeSearchUrl asks the geocoder for a short list of JSON results', () => {
  const url = new URL(placeSearchUrl(ENDPOINT, '  Stone Arch Bridge  ', { limit: 3 }));
  assert.equal(url.origin + url.pathname, ENDPOINT);
  assert.equal(url.searchParams.get('q'), 'Stone Arch Bridge');
  assert.equal(url.searchParams.get('format'), 'jsonv2');
  assert.equal(url.searchParams.get('limit'), '3');
  assert.equal(new URL(placeSearchUrl(ENDPOINT, 'x')).searchParams.get('limit'), '5');
});

test('placesFromResponse keeps only results that can be placed on the map', () => {
  const places = placesFromResponse([
    {
      place_id: 1,
      name: 'Stone Arch Bridge',
      display_name: 'Stone Arch Bridge, Minneapolis, Minnesota, United States',
      lat: '44.9812',
      lon: '-93.2565',
    },
    { place_id: 2, display_name: 'Nowhere', lat: 'abc', lon: '0' },
    { place_id: 3, display_name: 'Off the edge', lat: '95', lon: '0' },
    { place_id: 4, display_name: 'Only a trail, Somewhere', lat: '1.5', lon: '-2.5' },
  ]);
  assert.deepEqual(places, [
    {
      id: '1',
      name: 'Stone Arch Bridge',
      description: 'Stone Arch Bridge, Minneapolis, Minnesota, United States',
      latitude: 44.9812,
      longitude: -93.2565,
    },
    {
      id: '4',
      name: 'Only a trail',
      description: 'Only a trail, Somewhere',
      latitude: 1.5,
      longitude: -2.5,
    },
  ]);
  assert.deepEqual(placesFromResponse(null), []);
  assert.deepEqual(placesFromResponse({ error: 'nope' }), []);
});

test('searchPlaces fetches the geocoder and shapes the answer', async () => {
  const calls = [];
  const fetchImplementation = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      json: async () => [{ place_id: 9, name: 'Paris', lat: '48.8566', lon: '2.3522' }],
    };
  };
  const places = await searchPlaces(ENDPOINT, 'Paris', { fetchImplementation });
  assert.equal(calls.length, 1);
  assert.equal(new URL(calls[0].url).searchParams.get('q'), 'Paris');
  assert.equal(places.length, 1);
  assert.equal(places[0].name, 'Paris');
  assert.equal(places[0].longitude, 2.3522);
});

test('searchPlaces skips the network for a blank query and surfaces HTTP failures', async () => {
  let called = false;
  const blank = await searchPlaces(ENDPOINT, '   ', {
    fetchImplementation: async () => {
      called = true;
    },
  });
  assert.deepEqual(blank, []);
  assert.equal(called, false);

  await assert.rejects(
    searchPlaces(ENDPOINT, 'Paris', {
      fetchImplementation: async () => ({ ok: false, status: 429 }),
    }),
    (error) => error.status === 429
  );
  assert.match(describePlaceSearchError({ status: 429 }), /busy/);
  assert.match(describePlaceSearchError(new Error('boom')), /could not be reached/);
  assert.equal(describePlaceSearchError(null), '');
});
