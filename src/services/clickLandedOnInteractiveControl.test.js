import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clickLandedOnInteractiveControl } from './clickLandedOnInteractiveControl.js';

function clickOn(selectorMatch) {
  return {
    target: {
      closest: (selector) =>
        selectorMatch && selector.includes(selectorMatch) ? {} : null,
    },
  };
}

test('a press on a link, button, or frame is an inner control', () => {
  assert.equal(clickLandedOnInteractiveControl(clickOn('a')), true);
  assert.equal(clickLandedOnInteractiveControl(clickOn('button')), true);
  assert.equal(clickLandedOnInteractiveControl(clickOn('iframe')), true);
});

test('a press on the card surface is not an inner control', () => {
  assert.equal(clickLandedOnInteractiveControl(clickOn(null)), false);
  assert.equal(clickLandedOnInteractiveControl({ target: {} }), false);
  assert.equal(clickLandedOnInteractiveControl(null), false);
});
