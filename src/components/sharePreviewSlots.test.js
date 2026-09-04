import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getSharePreviewSlots,
  registerSharePreviewSlot,
  subscribeSharePreviewSlots,
} from './sharePreviewSlots.js';

test('registering a slot notifies subscribers and unregisters', () => {
  const seen = [];
  const stop = subscribeSharePreviewSlots((next) => seen.push(next));
  assert.equal(seen.length >= 1, true);
  const rail = { id: 'rail' };
  const forget = registerSharePreviewSlot('rail', rail);
  assert.equal(getSharePreviewSlots().rail, rail);
  assert.equal(seen.at(-1).rail, rail);
  forget();
  assert.equal(getSharePreviewSlots().rail, null);
  stop();
});

test('a stale unregister does not clear a newer slot', () => {
  const first = { id: 'first' };
  const second = { id: 'second' };
  const forgetFirst = registerSharePreviewSlot('panel', first);
  const forgetSecond = registerSharePreviewSlot('panel', second);
  forgetFirst();
  assert.equal(getSharePreviewSlots().panel, second);
  forgetSecond();
  assert.equal(getSharePreviewSlots().panel, null);
});
