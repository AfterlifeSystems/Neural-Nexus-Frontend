import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AVATAR_COLOR_SCHEME, rgbChannelsOf } from './avatarColorScheme.js';

test('hex colours convert to rgb channels for the speak glow', () => {
  assert.equal(rgbChannelsOf('#E57373'), '229, 115, 115');
  assert.equal(rgbChannelsOf('FFB74D'), '255, 183, 77');
  assert.equal(rgbChannelsOf('bad'), null);
});

test('every scheme colour is distinct and convertible', () => {
  const fills = new Set(AVATAR_COLOR_SCHEME.map((entry) => entry.fill));
  assert.equal(fills.size, AVATAR_COLOR_SCHEME.length);
  for (const entry of AVATAR_COLOR_SCHEME) {
    assert.notEqual(rgbChannelsOf(entry.fill), null);
    assert.notEqual(rgbChannelsOf(entry.ring), null);
  }
});
