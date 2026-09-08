import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTION_CHOICE_BUTTON_TYPE,
  ACTION_CHOICE_ELEMENT,
  actionChoiceButtonClassName,
} from './factReviewActionChoice.js';

test('fact-review actions are buttons, not hidden radios', () => {
  assert.equal(ACTION_CHOICE_ELEMENT, 'button');
  assert.equal(ACTION_CHOICE_BUTTON_TYPE, 'button');
  assert.doesNotMatch(
    actionChoiceButtonClassName({ selected: false }),
    /sr-only/
  );
});

test('FactReviewCard does not mount sr-only radios for actions', () => {
  const source = readFileSync(new URL('./FactReviewCard.jsx', import.meta.url), 'utf8');
  assert.match(source, /<button/);
  assert.match(source, /ACTION_CHOICE_BUTTON_TYPE/);
  assert.doesNotMatch(source, /type="radio"/);
  assert.doesNotMatch(source, /sr-only/);
});
