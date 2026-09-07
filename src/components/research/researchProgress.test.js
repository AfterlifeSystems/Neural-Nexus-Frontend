import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
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

test('the media hand-off is reported as its own stage', () => {
  assert.match(
    describeResearchStage({ stage: 'verified_media', media_sources: 3 }),
    /3 verified sources to learn from/
  );
  assert.equal(
    describeResearchStage({ stage: 'verified_media', media_sources: 0 }),
    'No verified media to learn from.'
  );
  assert.match(
    describeResearchStage({ stage: 'learning_from_media', media_sources: 1 }),
    /transcribing 1 verified source/
  );
  // The batch outlives the research job, so the line must not claim it finished.
  assert.match(
    describeResearchStage({ stage: 'media_started', media_batch: { status: 'started' } }),
    /appear in this avatar's uploaded material as they finish/
  );
  assert.match(
    describeResearchStage({
      stage: 'media_started',
      media_batch: { status: 'refused', detail: 'no storage left' },
    }),
    /could not be learned from: no storage left/
  );
});
