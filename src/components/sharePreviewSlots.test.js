import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getSharePreviewSlots,
  openCollapsedSidebar,
  registerSharePreviewSlot,
  revealSidebarSharePreviews,
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

test('clicking rail footage opens the collapsed sidebar', () => {
  const rail = {
    clicked: 0,
    click() {
      this.clicked += 1;
    },
  };
  const tile = {
    closest(selector) {
      return selector === '[data-sidebar-rail]' ? rail : null;
    },
  };
  assert.equal(openCollapsedSidebar(tile), true);
  assert.equal(rail.clicked, 1);
  assert.equal(openCollapsedSidebar(null), false);
  assert.equal(openCollapsedSidebar({ closest: () => null }), false);
});

test('revealing share previews scrolls the panel section into view', () => {
  const scrolled = [];
  const sharing = {
    scrollIntoView(options) {
      scrolled.push(options);
    },
  };
  const root = {
    querySelector(selector) {
      return selector === '[data-sidebar-sharing]' ? sharing : null;
    },
  };
  assert.equal(revealSidebarSharePreviews(root), true);
  assert.equal(scrolled.length, 1);
  assert.equal(scrolled[0].block, 'end');
  assert.equal(revealSidebarSharePreviews({ querySelector: () => null }), false);
});
