import { test } from 'node:test';
import assert from 'node:assert/strict';

import { interruptHeadingFor } from './interruptHeading.js';

test('a correction reads as a correction', () => {
  const one = interruptHeadingFor({ correctionKind: 'fact_correction', matchCount: 1 });
  assert.match(one.heading, /1 stored item that might match/);
  const many = interruptHeadingFor({ correctionKind: 'fact_correction', matchCount: 3 });
  assert.match(many.heading, /3 stored items that might match/);
  assert.match(many.guidance, /pre-selected to my recommendation/);
  assert.match(many.guidance, /avatar settings/);
  assert.match(many.guidance, /talking and typing/);
});

test('a researched contradiction asks which version is true', () => {
  const one = interruptHeadingFor({
    correctionKind: 'research_verification',
    matchCount: 1,
  });
  assert.match(one.heading, /1 fact that contradicts what I hold/);
  const many = interruptHeadingFor({
    correctionKind: 'research_verification',
    matchCount: 2,
  });
  assert.match(many.heading, /2 facts that contradict what I hold/);
  // The owner must not be told these are pre-selected: nothing is.
  assert.doesNotMatch(many.guidance, /pre-selected/);
  assert.match(many.guidance, /already learned/);
  assert.match(many.guidance, /avatar settings/);
});

test('an unknown kind falls back to the correction wording', () => {
  const fallback = interruptHeadingFor({ matchCount: 0 });
  assert.match(fallback.heading, /0 stored items/);
});
