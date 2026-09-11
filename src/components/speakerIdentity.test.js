import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { AVATAR_COLOR_SCHEME } from '../config/avatarColorScheme.js';
import { resetSpeakerColors, speakerIdentityOf } from './speakerIdentity.js';

beforeEach(() => resetSpeakerColors());

test('the same speaker string keeps the same animal', () => {
  const first = speakerIdentityOf('Speaker 2');
  const second = speakerIdentityOf('Speaker 2');
  assert.equal(first.name, second.name);
  assert.equal(first.emoji, second.emoji);
  assert.match(first.name, /^Anonymous /);
});

test('a lone overheard voice needs no colour', () => {
  const only = speakerIdentityOf('Speaker 2');
  assert.equal(only.fill, null);
  assert.equal(only.ring, null);
  // Asking again does not conjure one.
  assert.equal(speakerIdentityOf('Speaker 2').fill, null);
});

test('a second voice makes colours necessary; each voice keeps its own', () => {
  speakerIdentityOf('Speaker 2');
  const three = speakerIdentityOf('Speaker 3');
  const two = speakerIdentityOf('Speaker 2');
  assert.ok(two.fill && three.fill);
  assert.notEqual(two.fill, three.fill);
  assert.ok(AVATAR_COLOR_SCHEME.some((entry) => entry.fill === two.fill));
  assert.ok(AVATAR_COLOR_SCHEME.some((entry) => entry.fill === three.fill));
  // Stable on re-ask.
  assert.equal(speakerIdentityOf('Speaker 2').fill, two.fill);
  assert.equal(speakerIdentityOf('Speaker 3').fill, three.fill);
});

test('colours are dealt at random from the unworn scheme entries', () => {
  // Always pick the last free entry: the die is honoured, and the pool
  // shrinks as colours are taken.
  resetSpeakerColors({ random: (count) => count - 1 });
  speakerIdentityOf('A');
  speakerIdentityOf('B');
  const a = speakerIdentityOf('A');
  const b = speakerIdentityOf('B');
  assert.equal(a.fill, AVATAR_COLOR_SCHEME[AVATAR_COLOR_SCHEME.length - 1].fill);
  assert.equal(b.fill, AVATAR_COLOR_SCHEME[AVATAR_COLOR_SCHEME.length - 2].fill);
});

test('voices stay unique until the scheme runs out, then colours repeat', () => {
  const names = AVATAR_COLOR_SCHEME.map((_, index) => `Speaker ${index + 1}`);
  for (const name of names) speakerIdentityOf(name);
  const fills = names.map((name) => speakerIdentityOf(name).fill);
  assert.equal(new Set(fills).size, AVATAR_COLOR_SCHEME.length);
  const extra = speakerIdentityOf('Speaker 99');
  assert.ok(fills.includes(extra.fill));
});
