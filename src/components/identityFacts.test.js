import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  collapseDuplicateIdentityFacts,
  countsFromFacts,
  factRowKey,
  filterFacts,
  normalizeFactText,
} from './identityFacts.js';

const conversation = (fact, key, extras = {}) => ({
  fact,
  context: extras.context ?? 'Told in chat',
  learnedFrom: 'conversation',
  namespace: ['owner', 'grant', 'identity_memory'],
  key,
  factId: key,
  ...extras,
});

test('collapseDuplicateIdentityFacts drops a second copy of the same store row', () => {
  const collapsed = collapseDuplicateIdentityFacts([
    conversation('The facility was known on the show as M7.', 'k1'),
    conversation('The facility was known on the show as M7.', 'k1'),
  ]);
  assert.equal(collapsed.length, 1);
  assert.equal(collapsed[0].key, 'k1');
  assert.equal(collapsed[0].duplicateFacts, undefined);
});

test('collapseDuplicateIdentityFacts keeps the first sentence and records the extra store key', () => {
  const collapsed = collapseDuplicateIdentityFacts([
    conversation(
      'The move to M7 occurred around 2005, roughly coinciding with when I joined MythBusters.',
      'k1',
      { context: 'The user asked me to learn that during Grant Imahara’s time on MythBusters.' }
    ),
    conversation(
      'The move to M7 occurred around 2005, roughly coinciding with when I joined MythBusters.',
      'k2'
    ),
  ]);
  assert.equal(collapsed.length, 1);
  assert.equal(collapsed[0].key, 'k1');
  assert.deepEqual(collapsed[0].duplicateFacts, [
    { namespace: ['owner', 'grant', 'identity_memory'], key: 'k2' },
  ]);
});

test('collapseDuplicateIdentityFacts leaves distinct sentences apart', () => {
  const collapsed = collapseDuplicateIdentityFacts([
    conversation('The facility was known on the show as M7.', 'k1'),
    conversation(
      'The facility was leased specifically as a dedicated build space for the Build Team.',
      'k2'
    ),
    conversation(
      'During my time on MythBusters, my primary office and workshop was located at 2200 Jerrold Avenue.',
      'k3'
    ),
  ]);
  assert.equal(collapsed.length, 3);
});

test('collapseDuplicateIdentityFacts does not merge the same sentence from two groups', () => {
  const collapsed = collapseDuplicateIdentityFacts([
    conversation('I was born in Ottawa.', 'c1'),
    {
      fact: 'I was born in Ottawa.',
      learnedFrom: 'media',
      namespace: ['owner', 'grant', 'identity', 'upload'],
      key: 'm1',
    },
  ]);
  assert.equal(collapsed.length, 2);
});

test('countsFromFacts matches the collapsed list so the filter chip agrees with the cards', () => {
  const collapsed = collapseDuplicateIdentityFacts([
    conversation('The facility was known on the show as M7.', 'k1'),
    conversation('The facility was known on the show as M7.', 'k2'),
    conversation('The move to M7 occurred around 2005.', 'k3'),
    conversation('The move to M7 occurred around 2005.', 'k4'),
    conversation('The facility was leased specifically as a dedicated build space.', 'k5'),
    conversation('The facility was leased specifically as a dedicated build space.', 'k6'),
    conversation(
      'During my time on MythBusters, my primary office was at 2200 Jerrold Avenue.',
      'k7'
    ),
  ]);
  assert.equal(collapsed.length, 4);
  const counts = countsFromFacts(collapsed);
  assert.equal(counts.conversation, 4);
  assert.equal(filterFacts(collapsed, 'conversation', '').length, 4);
  const keys = collapsed.map(factRowKey);
  assert.equal(new Set(keys).size, keys.length);
});

test('filterFacts still finds a row by its context', () => {
  const rows = [
    conversation('The facility was known on the show as M7.', 'k1', {
      context: 'The user asked me to learn that during Grant Imahara’s time on MythBusters.',
    }),
  ];
  assert.equal(filterFacts(rows, 'all', 'jerrold').length, 0);
  assert.equal(filterFacts(rows, 'all', 'grant imahara').length, 1);
});

test('normalizeFactText treats padded copies as the same sentence', () => {
  assert.equal(
    normalizeFactText('  The facility was known on the show as M7.  '),
    normalizeFactText('the facility was known on the show as m7.')
  );
});

test('factRowKey falls back to the sentence when the store key is missing', () => {
  const a = {
    fact: 'The facility was known on the show as M7.',
    learnedFrom: 'conversation',
    namespace: [],
    key: null,
  };
  const b = {
    fact: 'The facility was known on the show as M7.',
    learnedFrom: 'conversation',
    namespace: [],
    key: null,
  };
  assert.equal(factRowKey(a), factRowKey(b));
  assert.notEqual(factRowKey(a), '::');
});

test('AvatarIdentityFacts collapses the listing and opens context as details', () => {
  const source = readFileSync(
    new URL('./AvatarIdentityFacts.jsx', import.meta.url),
    'utf8'
  );
  assert.match(source, /collapseDuplicateIdentityFacts/);
  assert.match(source, /countsFromFacts/);
  assert.match(source, /<details/);
  assert.match(source, /<summary/);
  assert.doesNotMatch(source, /isContextOpen/);
});
