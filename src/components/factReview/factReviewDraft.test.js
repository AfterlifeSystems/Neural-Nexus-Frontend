import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  attachFactReviewDraft,
  collapsedFactReviewSummary,
  createFactReviewDraft,
  factReviewResumeItems,
  patchFactReviewDecision,
  patchFactReviewDraft,
  seedFactReviewDecisions,
  settingsSectionForFactReview,
  skipAllFactReviewItems,
} from './factReviewDraft.js';

const MATCHES = [
  {
    index: 0,
    recommended_action: 'accept',
    suggested_edit_fact_content: 'Born in Ottawa.',
    suggested_edit_fact_context: 'Birthplace',
  },
  {
    index: 1,
    recommended_action: 'mystery',
    suggested_edit_fact_content: 'Sails.',
  },
];

test('an unrecognized recommendation falls back to skip', () => {
  const seeded = seedFactReviewDecisions(MATCHES);
  assert.equal(seeded[0].action, 'accept');
  assert.equal(seeded[0].correctedText, 'Born in Ottawa.');
  assert.equal(seeded[1].action, 'skip');
  assert.equal(seeded[1].correctedText, 'Sails.');
});

test('a new draft starts folded so the conversation is not forced through the form', () => {
  const draft = createFactReviewDraft({ matches: MATCHES });
  assert.equal(draft.collapsed, true);
  assert.equal(draft.isConfirmingRemovals, false);
  assert.equal(draft.decisions[0].action, 'accept');
});

test('attaching a draft does not wipe choices already made', () => {
  const pending = {
    interrupt: { matches: MATCHES },
    factReviewDraft: {
      collapsed: false,
      isConfirmingRemovals: false,
      decisions: { 0: { action: 'remove', correctedText: '', correctedContext: '' } },
    },
  };
  assert.equal(attachFactReviewDraft(pending).factReviewDraft.decisions[0].action, 'remove');
  const fresh = attachFactReviewDraft({ interrupt: { matches: MATCHES } });
  assert.equal(fresh.factReviewDraft.collapsed, true);
  assert.equal(fresh.factReviewDraft.decisions[0].action, 'accept');
});

test('a pause with no matches is left alone', () => {
  const connect = { interrupt: { kind: 'connect_account' } };
  assert.equal(attachFactReviewDraft(connect).factReviewDraft, undefined);
});

test('editing one card keeps the others and clears a removal confirmation', () => {
  const draft = patchFactReviewDraft(createFactReviewDraft({ matches: MATCHES }), {
    isConfirmingRemovals: true,
  });
  const next = patchFactReviewDecision(draft, 0, { action: 'remove' });
  assert.equal(next.isConfirmingRemovals, false);
  assert.equal(next.decisions[0].action, 'remove');
  assert.equal(next.decisions[0].correctedText, 'Born in Ottawa.');
  assert.equal(next.decisions[1].action, 'skip');
});

test('resume items follow the draft, and later skips every match', () => {
  const draft = patchFactReviewDecision(
    createFactReviewDraft({ matches: MATCHES }),
    0,
    { action: 'remove' }
  );
  assert.deepEqual(factReviewResumeItems(MATCHES, draft.decisions), [
    {
      index: 0,
      action: 'remove',
      corrected_text: 'Born in Ottawa.',
      correction_context: 'Birthplace',
    },
    {
      index: 1,
      action: 'skip',
      corrected_text: 'Sails.',
      correction_context: '',
    },
  ]);
  assert.deepEqual(skipAllFactReviewItems(MATCHES), [
    { index: 0, action: 'skip', corrected_text: '', correction_context: '' },
    { index: 1, action: 'skip', corrected_text: '', correction_context: '' },
  ]);
});

test('settings scroll targets match the kind of pause', () => {
  assert.equal(settingsSectionForFactReview('research_verification'), 'research');
  assert.equal(settingsSectionForFactReview('fact_correction'), 'facts');
  assert.equal(settingsSectionForFactReview(undefined), 'facts');
});

test('the folded summary names both later places', () => {
  assert.match(
    collapsedFactReviewSummary({
      correctionKind: 'research_verification',
      matchCount: 2,
    }),
    /later in this conversation or in avatar settings/
  );
  assert.match(
    collapsedFactReviewSummary({ matchCount: 1 }),
    /stored item can wait/
  );
});

test('the conversation panel reads the draft from the pending interrupt', () => {
  const source = readFileSync(
    new URL('../InterruptPanel.jsx', import.meta.url),
    'utf8'
  );
  assert.match(source, /factReviewDraft/);
  assert.match(source, /updateFactReviewDraft/);
  assert.doesNotMatch(source, /const \[decisions, setDecisions\]/);
  assert.match(source, /I'll decide later/);
  assert.match(source, /Avatar settings/);
});

test('avatar settings has scroll targets for deferred fact review', () => {
  const source = readFileSync(
    new URL('../AvatarSettings.jsx', import.meta.url),
    'utf8'
  );
  assert.match(source, /section === 'research'/);
  assert.match(source, /section === 'facts'/);
  assert.match(source, /id="avatar-research"/);
  assert.match(source, /id="avatar-facts"/);
});
