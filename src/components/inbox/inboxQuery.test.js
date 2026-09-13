import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  INBOX_SOURCE_FILTERS,
  inboxListRequestOptions,
  isBanDecisionItem,
  moderationDecision,
  moderationEvidenceLines,
} from './inboxQuery.js';

test('inbox list options omit empty search and source filters', () => {
  assert.deepEqual(inboxListRequestOptions({ state: 'open' }), {
    state: 'open',
    limit: 100,
  });
});

test('inbox list options send search and source kind when set', () => {
  assert.deepEqual(
    inboxListRequestOptions({
      state: 'all',
      query: '  woods  ',
      sourceKind: 'moderation',
      limit: 50,
    }),
    { state: 'all', limit: 50, q: 'woods', source_kind: 'moderation' }
  );
});

test('source filters include Moderation and Appeals among All, Reports, and Mail', () => {
  const labels = INBOX_SOURCE_FILTERS.map((filter) => filter.label);
  assert.deepEqual(labels, ['All', 'Moderation', 'Appeals', 'Reports', 'Mail']);
});

test('moderation decisions are accept with revoke or accept action', () => {
  assert.deepEqual(moderationDecision('revoke_ban'), {
    type: 'accept',
    args: { action: 'revoke_ban' },
  });
  assert.deepEqual(moderationDecision('accept_ban'), {
    type: 'accept',
    args: { action: 'accept_ban' },
  });
});

test('ban decision items are moderation verdicts and appeals', () => {
  assert.equal(isBanDecisionItem({ source_kind: 'moderation' }), true);
  assert.equal(isBanDecisionItem({ source_kind: 'appeal' }), true);
  assert.equal(isBanDecisionItem({ source_kind: 'email' }), false);
});

test('moderation evidence prefers the judge quotes, then the snippet', () => {
  assert.deepEqual(
    moderationEvidenceLines({
      snippet: 'fallback',
      confidence_detail: { supporting_evidence: ['quoted line', ''] },
    }),
    ['quoted line']
  );
  assert.deepEqual(
    moderationEvidenceLines({ snippet: 'first\nsecond' }),
    ['first', 'second']
  );
});
