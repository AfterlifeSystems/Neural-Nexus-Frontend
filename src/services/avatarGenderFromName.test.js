import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  givenNameOfAvatar,
  inferAvatarGenderFromName,
} from './avatarGenderFromName.js';

test('the given name skips titles such as A.I. and Dr', () => {
  assert.equal(givenNameOfAvatar('A.I. Shivon Zilis'), 'Shivon');
  assert.equal(givenNameOfAvatar('Dr Maya Chen'), 'Maya');
  assert.equal(givenNameOfAvatar('Evan Woods'), 'Evan');
});

test('a known given name infers a speaking gender', () => {
  assert.equal(inferAvatarGenderFromName('Shivon Zilis'), 'female');
  assert.equal(inferAvatarGenderFromName('A.I. Shivon Zilis'), 'female');
  assert.equal(inferAvatarGenderFromName('Evan Woods'), 'male');
  assert.equal(inferAvatarGenderFromName('Maya'), 'female');
});

test('an unknown or empty name does not guess', () => {
  assert.equal(inferAvatarGenderFromName(''), null);
  assert.equal(inferAvatarGenderFromName('Xzzyq'), null);
  assert.equal(inferAvatarGenderFromName('A.I.'), null);
});
