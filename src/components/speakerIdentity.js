// src/components/speakerIdentity.js
//
// A stable guest face for a third-party voice, in the same spirit as the
// anonymous animals in a shared Google Doc: one animal per speaker string, so
// "Speaker 2" is the same Fox for the whole conversation.
//
// Colour is only there to tell two overheard voices apart, so it is added
// only when necessary: a lone guest wears the neutral disc; once a second
// distinct voice is heard in this session, each guest is given a colour drawn
// at random from the scheme, unique among the voices heard so far, and keeps
// it. Nothing is chosen by the person and nothing is stored.

import { AVATAR_COLOR_SCHEME } from '../config/avatarColorScheme.js';

const GUEST_ANIMALS = [
  { name: 'Alligator', emoji: '🐊' },
  { name: 'Badger', emoji: '🦡' },
  { name: 'Bear', emoji: '🐻' },
  { name: 'Dolphin', emoji: '🐬' },
  { name: 'Elephant', emoji: '🐘' },
  { name: 'Fox', emoji: '🦊' },
  { name: 'Giraffe', emoji: '🦒' },
  { name: 'Hippo', emoji: '🦛' },
  { name: 'Koala', emoji: '🐨' },
  { name: 'Lion', emoji: '🦁' },
  { name: 'Monkey', emoji: '🐵' },
  { name: 'Octopus', emoji: '🐙' },
  { name: 'Otter', emoji: '🦦' },
  { name: 'Owl', emoji: '🦉' },
  { name: 'Panda', emoji: '🐼' },
  { name: 'Penguin', emoji: '🐧' },
  { name: 'Rabbit', emoji: '🐰' },
  { name: 'Raccoon', emoji: '🦝' },
  { name: 'Tiger', emoji: '🐯' },
  { name: 'Unicorn', emoji: '🦄' },
  { name: 'Wolf', emoji: '🐺' },
  { name: 'Zebra', emoji: '🦓' },
];

function hashString(value) {
  let hash = 2166136261;
  const text = String(value ?? '');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Speaker key → scheme entry, in the order voices were first heard. */
const assignedColors = new Map();
let pickIndex = (count) => Math.floor(Math.random() * count);

/**
 * Forget every colour handed out so far. For tests; `random` replaces the
 * die so a pick is predictable.
 *
 * @param {Object} [options]
 * @param {(count: number) => number} [options.random]
 */
export function resetSpeakerColors({ random } = {}) {
  assignedColors.clear();
  pickIndex =
    typeof random === 'function'
      ? random
      : (count) => Math.floor(Math.random() * count);
}

/**
 * The colour this voice was dealt, dealing one the first time it is heard.
 * Colours not yet worn by another voice are preferred; only when the scheme
 * is exhausted does a colour repeat.
 *
 * @param {string} key
 * @returns {{fill: string, ring: string, label: string}}
 */
function colorForSpeaker(key) {
  const existing = assignedColors.get(key);
  if (existing) return existing;
  const worn = new Set(
    Array.from(assignedColors.values(), (entry) => entry.fill)
  );
  const free = AVATAR_COLOR_SCHEME.filter((entry) => !worn.has(entry.fill));
  const pool = free.length > 0 ? free : AVATAR_COLOR_SCHEME;
  const index = Math.min(
    Math.max(0, Math.floor(Number(pickIndex(pool.length)) || 0)),
    pool.length - 1
  );
  const color = pool[index];
  assignedColors.set(key, color);
  return color;
}

/**
 * The guest identity for one diarized speaker string.
 *
 * `fill` / `ring` are null while colour is unnecessary — this is the only
 * overheard voice so far — and the disc stays neutral.
 *
 * @param {string} speaker The API's speaker label, e.g. "Speaker 2".
 * @returns {{key: string, name: string, shortName: string, emoji: string, fill: string|null, ring: string|null}}
 */
export function speakerIdentityOf(speaker) {
  const key = String(speaker ?? '').trim() || 'Speaker';
  const animal = GUEST_ANIMALS[hashString(key) % GUEST_ANIMALS.length];
  const color = colorForSpeaker(key);
  const colorNeeded = assignedColors.size > 1;
  return {
    key,
    name: `Anonymous ${animal.name}`,
    shortName: animal.name,
    emoji: animal.emoji,
    fill: colorNeeded ? color.fill : null,
    ring: colorNeeded ? color.ring : null,
  };
}
