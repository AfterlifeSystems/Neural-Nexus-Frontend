import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  COMPOSER_INPUT_SELECTOR,
  focusComposer,
} from './composerFocus.js';

test('focusComposer focuses the marked composer and ignores a missing one', () => {
  const focused = [];
  const composer = {
    disabled: false,
    focus() {
      focused.push('composer');
    },
    scrollIntoView() {},
  };
  const root = {
    querySelector(selector) {
      return selector === COMPOSER_INPUT_SELECTOR ? composer : null;
    },
  };
  assert.equal(focusComposer(root), true);
  assert.deepEqual(focused, ['composer']);
  assert.equal(focusComposer({ querySelector: () => null }), false);
  assert.equal(
    focusComposer({
      querySelector: () => ({ ...composer, disabled: true }),
    }),
    false
  );
});
