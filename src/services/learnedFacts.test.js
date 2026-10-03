import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  learnedFactsOf,
  mergeLearnedFacts,
  normalizeLearnedFact,
  normalizeLearnedFacts,
} from './learnedFacts.js';

test('an entry from an older server with no status reads as learned', () => {
  assert.deepEqual(normalizeLearnedFact({ fact: 'I sang baritone.', kind: 'identity' }), {
    fact: 'I sang baritone.',
    kind: 'identity',
    source: 'conversation',
    status: 'learned',
  });
});

test('an updated fact keeps the text the correction replaced', () => {
  assert.deepEqual(
    normalizeLearnedFact({
      fact: "I would say 'You're going to run out of space'.",
      kind: 'user',
      status: 'updated',
      previous_fact: "I would say 'write small'.",
    }),
    {
      fact: "I would say 'You're going to run out of space'.",
      kind: 'user',
      source: 'conversation',
      status: 'updated',
      previousFact: "I would say 'write small'.",
    }
  );
});

test('an unknown status falls back to learned', () => {
  assert.equal(normalizeLearnedFact({ fact: 'I sang baritone.', status: 'invented' }).status, 'learned');
});

test('the same fact with two statuses keeps both entries once each', () => {
  const entries = normalizeLearnedFacts([
    { fact: 'I sang baritone.', status: 'removed' },
    { fact: 'I sang baritone.', status: 'learned' },
    { fact: 'i sang baritone.', status: 'learned' },
  ]);
  assert.deepEqual(
    entries.map((entry) => entry.status),
    ['removed', 'learned']
  );
});

test('a live frame merged twice is normalized once and keeps previousFact', () => {
  const afterFirstFrame = mergeLearnedFacts([], {
    fact: 'I played French horn.',
    status: 'updated',
    previous_fact: 'I played trumpet.',
  });
  const afterSecondFrame = mergeLearnedFacts(afterFirstFrame, {
    fact: 'I taught Evan to write.',
    status: 'known',
  });
  assert.deepEqual(
    afterSecondFrame.map((entry) => [entry.status, entry.fact, entry.previousFact]),
    [
      ['updated', 'I played French horn.', 'I played trumpet.'],
      ['known', 'I taught Evan to write.', undefined],
    ]
  );
});

test('a reloaded reply reads every status from response_metadata', () => {
  const entries = learnedFactsOf({
    response_metadata: {
      learned_facts: [
        { fact: 'I played French horn.', kind: 'identity', status: 'learned' },
        { fact: 'I taught Evan to write.', kind: 'identity', status: 'known' },
      ],
    },
  });
  assert.deepEqual(
    entries.map((entry) => entry.status),
    ['learned', 'known']
  );
});
