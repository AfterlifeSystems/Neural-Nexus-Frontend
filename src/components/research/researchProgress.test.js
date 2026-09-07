import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildResolutionItems,
  defaultDecisionForProposal,
  describeResearchOutcome,
  describeResearchStage,
} from './researchProgress.js';

test('every research stage says what is happening', () => {
  assert.equal(
    describeResearchStage({ stage: 'scoping' }),
    'Reading what this avatar already knows…'
  );
  assert.equal(
    describeResearchStage({ stage: 'scoped', topics: ['history', 'work'] }),
    'Researching: history · work'
  );
  assert.equal(
    describeResearchStage({ stage: 'searched', topic: 'history', sources: [1, 2] }),
    'Found 2 sources (history).'
  );
  assert.equal(
    describeResearchStage({
      stage: 'verified',
      consistent: 3,
      inconsistent: 1,
      unverified: 2,
    }),
    'Verified: 3 agreed, 1 contradicted, 2 from a single source.'
  );
  assert.equal(describeResearchStage({}), '');
});

test('a finished job says what was learned and what needs a decision', () => {
  assert.equal(
    describeResearchOutcome({
      status: 'completed',
      result: { applied: 4, proposals: 0 },
    }),
    'Research finished: 4 facts were added to what this avatar knows. Nothing was contradicted.'
  );
  assert.match(
    describeResearchOutcome({
      status: 'completed',
      result: { applied: 1, proposals: 2 },
    }),
    /1 fact was added .*2 facts contradict/
  );
  assert.equal(
    describeResearchOutcome({ status: 'cancelled' }),
    'Research cancelled.'
  );
  assert.equal(
    describeResearchOutcome({ status: 'error', error: 'no key' }),
    'Research failed: no key'
  );
});

test('a contradiction is ignored until a person chooses a version', () => {
  assert.equal(defaultDecisionForProposal(), 'ignore');

  const proposals = [
    { fact_id: 'a', fact: 'I was born in 1979.' },
    { fact_id: 'b', fact: 'I trained in Leeds.' },
    { fact_id: 'c', fact: 'I never left the county.' },
  ];
  const items = buildResolutionItems(
    proposals,
    { a: 'accept', b: 'edit' },
    { b: '  I trained in Bradford. ' }
  );

  assert.deepEqual(items, [
    { fact_id: 'a', action: 'accept' },
    { fact_id: 'b', action: 'edit', corrected_text: 'I trained in Bradford.' },
    { fact_id: 'c', action: 'ignore' },
  ]);
});
