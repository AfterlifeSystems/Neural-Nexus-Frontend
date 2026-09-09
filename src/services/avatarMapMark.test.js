import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  avatarDescriptionOf,
  avatarMatchesSearch,
  initialsOf,
  mapMarkOf,
} from './avatarMapMark.js';

test('the description is read from wherever the record keeps it', () => {
  assert.equal(avatarDescriptionOf({ description: '  A guide.  ' }), 'A guide.');
  assert.equal(
    avatarDescriptionOf({ metadata: { description: 'From metadata' } }),
    'From metadata'
  );
  assert.equal(avatarDescriptionOf({ metadata: { bio: 'A bio' } }), 'A bio');
  assert.equal(avatarDescriptionOf({ description: 42 }), '');
  assert.equal(avatarDescriptionOf(null), '');
});

test('initials come from the avatar name', () => {
  assert.equal(initialsOf('Stone Arch'), 'SA');
  assert.equal(initialsOf('Bridge'), 'BR');
  assert.equal(initialsOf('  '), '?');
  assert.equal(mapMarkOf({ name: 'Evan Assist' }).label, 'Evan Assist');
});

test('a real-world avatar can be found by name, initials, or place', () => {
  const avatar = { name: 'Stone Arch' };
  const pin = { location_name: 'Minneapolis' };
  assert.equal(avatarMatchesSearch(avatar, '', pin), true);
  assert.equal(avatarMatchesSearch(avatar, 'stone', pin), true);
  assert.equal(avatarMatchesSearch(avatar, 'SA', pin), true);
  assert.equal(avatarMatchesSearch(avatar, 'minneapolis', pin), true);
  assert.equal(avatarMatchesSearch(avatar, 'paris', pin), false);
});
