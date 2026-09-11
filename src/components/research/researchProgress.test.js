import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ACQUISITION_STAGES,
  describeResearchOutcome,
  describeResearchStage,
  reportsAssetStored,
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

test('the researcher agent reports reflecting and tidying as its own steps', () => {
  // The researcher decides for itself when to search again, so the reflection
  // it records is a step the owner sees rather than a hidden pipeline stage.
  assert.match(
    describeResearchStage({
      stage: 'reflecting',
      topic: 'history',
      gap_summary: 'No dates yet.',
    }),
    /history.*No dates yet/
  );
  assert.match(
    describeResearchStage({ stage: 'compressing', topic: 'history' }),
    /Tidying up what was found \(history\)/
  );
});

test('the acquisition stages say what is being looked for and what was found', () => {
  // Creating an avatar now goes looking for a picture and a recording of the
  // subject. Each step says which of the two it is working on, because they run
  // alongside the fact research and the owner is watching one stream.
  assert.match(
    describeResearchStage({
      stage: 'bootstrap_scoping',
      needs_portrait: true,
      needs_voice: true,
    }),
    /a picture and a recording/
  );
  assert.match(
    describeResearchStage({
      stage: 'bootstrap_scoping',
      needs_portrait: false,
      needs_voice: true,
    }),
    /a recording/
  );
  assert.match(
    describeResearchStage({ stage: 'finding_portrait', candidates: 3 }),
    /3 pictures/
  );
  assert.match(
    describeResearchStage({ stage: 'finding_portrait', candidates: 1 }),
    /1 picture\b/
  );
  assert.match(
    describeResearchStage({ stage: 'vetting_portrait' }),
    /really shows the subject/
  );
  assert.match(
    describeResearchStage({
      stage: 'portrait_found',
      url: 'https://en.wikipedia.org/wiki/Ada_Lovelace',
    }),
    /en\.wikipedia\.org/
  );
  assert.equal(
    describeResearchStage({ stage: 'portrait_stored' }),
    'The portrait is set.'
  );
});

test('a subject that could not be identified is told to the owner, with the reason', () => {
  // Acquiring nothing is a real outcome, not a silent one: the owner is asked
  // to supply what the research could not find.
  const noPortrait = describeResearchStage({
    stage: 'portrait_not_found',
    reason: 'no candidate could be confirmed as this subject',
  });
  assert.match(noPortrait, /No usable photograph was found/);
  assert.match(noPortrait, /no candidate could be confirmed/);
  assert.match(noPortrait, /Add a portrait in Settings/);

  const noVoice = describeResearchStage({
    stage: 'voice_not_found',
    reason: 'no recording of a usable length was found',
  });
  assert.match(noVoice, /No usable recording was found/);
  assert.match(noVoice, /Upload one in Settings/);

  assert.match(
    describeResearchStage({
      stage: 'bootstrap_done',
      portrait_acquired: false,
      voice_acquired: false,
    }),
    /Nothing could be acquired/
  );
});

test('a found recording is named with its length', () => {
  assert.match(
    describeResearchStage({
      stage: 'voice_found',
      title: 'A conversation with Ada',
      duration_seconds: 1800,
    }),
    /A conversation with Ada.*30 min/
  );
  assert.equal(
    describeResearchStage({ stage: 'voice_stored' }),
    'The reference voice is set from that recording.'
  );
  assert.match(
    describeResearchStage({
      stage: 'bootstrap_done',
      portrait_acquired: true,
      voice_acquired: true,
    }),
    /Acquired a portrait and a reference voice/
  );
});

test('the acquisition stages are kept apart from the research stages', () => {
  // The two tracks run at the same time on one stream, so the panel needs to
  // know which line each frame belongs on.
  for (const stage of [
    'bootstrap_scoping',
    'finding_portrait',
    'portrait_stored',
    'voice_not_found',
    'bootstrap_done',
  ]) {
    assert.equal(ACQUISITION_STAGES.has(stage), true, stage);
  }
  for (const stage of ['scoping', 'researching', 'verifying', 'applied']) {
    assert.equal(ACQUISITION_STAGES.has(stage), false, stage);
  }
  assert.equal(reportsAssetStored({ stage: 'portrait_stored' }, 'portrait'), true);
  assert.equal(reportsAssetStored({ stage: 'portrait_stored' }, 'voice'), false);
  assert.equal(reportsAssetStored({ stage: 'voice_stored' }, 'voice'), true);
});
