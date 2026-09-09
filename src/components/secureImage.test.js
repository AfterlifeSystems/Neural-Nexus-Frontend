import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CHAT_IMAGE_COLLAPSED_HEIGHT_CLASS,
  CHAT_IMAGE_EXPANDED_HEIGHT_CLASS,
  chatImageClassName,
  chatImageToggleLabel,
} from './secureImage.js';

const classSet = (className) => new Set(className.split(/\s+/).filter(Boolean));

test('a chat image starts capped and grows when expanded', () => {
  const collapsed = classSet(chatImageClassName(false));
  const expanded = classSet(chatImageClassName(true));

  assert.equal(collapsed.has(CHAT_IMAGE_COLLAPSED_HEIGHT_CLASS), true);
  assert.equal(collapsed.has(CHAT_IMAGE_EXPANDED_HEIGHT_CLASS), false);
  assert.equal(expanded.has(CHAT_IMAGE_EXPANDED_HEIGHT_CLASS), true);
  assert.equal(expanded.has(CHAT_IMAGE_COLLAPSED_HEIGHT_CLASS), false);
  assert.equal(expanded.has('w-full'), true);
  assert.equal(collapsed.has('w-full'), false);
});

test('the toggle names enlarge and shrink from the filename', () => {
  assert.equal(chatImageToggleLabel(false, 'plot.png'), 'Enlarge plot.png');
  assert.equal(chatImageToggleLabel(true, 'plot.png'), 'Shrink plot.png');
  assert.equal(chatImageToggleLabel(false, '  '), 'Enlarge Image');
  assert.equal(chatImageToggleLabel(true), 'Shrink Image');
});
