import { test } from 'node:test';
import assert from 'node:assert/strict';

import { recommendationHintFor } from './factReviewHint.js';

test('a researched contradiction is never advice to leave things alone', () => {
  const againstAStoredFact = recommendationHintFor({
    kind: 'research_proposal',
    recommended_action: 'skip',
    has_stored_fact: true,
  });
  assert.match(againstAStoredFact, /only you can say which version is true/);
  assert.doesNotMatch(againstAStoredFact, /unchanged/);

  const nothingStoredYet = recommendationHintFor({
    kind: 'research_proposal',
    recommended_action: 'skip',
    has_stored_fact: false,
  });
  assert.match(nothingStoredYet, /holds nothing on this point yet/);
  assert.doesNotMatch(nothingStoredYet, /unchanged/);
});

test('a correction keeps the wording it had', () => {
  assert.equal(
    recommendationHintFor({ kind: 'fact', recommended_action: 'remove' }),
    'I recommend removing this document.'
  );
  // The pre-filled suggested edit is itself the recommendation.
  assert.equal(
    recommendationHintFor({ kind: 'fact', recommended_action: 'accept' }),
    null
  );
  assert.equal(
    recommendationHintFor({ kind: 'fact', recommended_action: 'skip' }),
    'I recommend leaving this document unchanged.'
  );
});
