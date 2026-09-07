import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildProposalResolutions,
  researchProposalAsCard,
} from './researchProposalCard.js';

const PROPOSAL = {
  fact_id: 'f1',
  fact: 'I was born in Ottawa.',
  existing_fact: 'I was born in Toronto.',
  fact_context: 'Place of birth.',
  reasoning: 'Two sources say Ottawa.',
  conflicting_statements: ['born in Ottawa'],
  supporting_source_urls: ['https://example.com/a'],
  verification_status: 'inconsistent',
};

test('a proposal renders in the same card the conversation uses', () => {
  const card = researchProposalAsCard(0, PROPOSAL);
  assert.equal(card.current_fact_content, 'I was born in Toronto.');
  assert.equal(card.suggested_edit_fact_content, 'I was born in Ottawa.');
  // Nothing is pre-selected: only the owner can say which version is true.
  assert.equal(card.recommended_action, 'skip');
  assert.equal(card.default_action, 'skip');
  assert.match(card.document_excerpt, /Two sources say Ottawa/);
  assert.match(card.document_excerpt, /example\.com/);
});

test('a proposal with nothing stored still reads sensibly', () => {
  const card = researchProposalAsCard(1, { fact_id: 'f2', fact: 'I sail.' });
  assert.equal(card.current_fact_content, '(nothing stored yet on this point)');
  assert.equal(card.suggested_edit_fact_content, 'I sail.');
});

test('an untouched contradiction keeps waiting', () => {
  assert.deepEqual(buildProposalResolutions([PROPOSAL], {}), []);
  assert.deepEqual(
    buildProposalResolutions([PROPOSAL], { 0: { action: 'skip' } }),
    []
  );
});

test('accepting, editing and discarding map to the resolve endpoint', () => {
  assert.deepEqual(
    buildProposalResolutions([PROPOSAL], { 0: { action: 'accept' } }),
    [{ fact_id: 'f1', action: 'accept' }]
  );
  // Accepting the suggestion unchanged is an accept, not an edit.
  assert.deepEqual(
    buildProposalResolutions([PROPOSAL], {
      0: { action: 'accept', correctedText: 'I was born in Ottawa.' },
    }),
    [{ fact_id: 'f1', action: 'accept' }]
  );
  assert.deepEqual(
    buildProposalResolutions([PROPOSAL], {
      0: { action: 'accept', correctedText: 'I was born in Hull.' },
    }),
    [{ fact_id: 'f1', action: 'edit', corrected_text: 'I was born in Hull.' }]
  );
  assert.deepEqual(
    buildProposalResolutions([PROPOSAL], { 0: { action: 'remove' } }),
    [{ fact_id: 'f1', action: 'ignore' }]
  );
});
