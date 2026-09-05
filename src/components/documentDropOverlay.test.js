import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  didDragLeaveViewport,
  isDropOverlayCancelKey,
  isFileOrUrlDrag,
} from './documentDropOverlay.js';

const VIEWPORT = { width: 800, height: 600 };

test('isFileOrUrlDrag accepts file and URL payloads only', () => {
  assert.equal(isFileOrUrlDrag({ types: ['Files'] }), true);
  assert.equal(isFileOrUrlDrag({ types: ['text/uri-list'] }), true);
  assert.equal(isFileOrUrlDrag({ types: ['Files', 'text/plain'] }), true);
  assert.equal(isFileOrUrlDrag({ types: ['text/plain'] }), false);
  assert.equal(isFileOrUrlDrag({ types: [] }), false);
  assert.equal(isFileOrUrlDrag(null), false);
  assert.equal(isFileOrUrlDrag(undefined), false);
});

test('didDragLeaveViewport is false while the pointer is inside the window', () => {
  assert.equal(didDragLeaveViewport(12, 20, VIEWPORT), false);
  assert.equal(didDragLeaveViewport(799, 599, VIEWPORT), false);
});

test('didDragLeaveViewport is true on or past any window edge', () => {
  assert.equal(didDragLeaveViewport(0, 100, VIEWPORT), true);
  assert.equal(didDragLeaveViewport(100, 0, VIEWPORT), true);
  assert.equal(didDragLeaveViewport(800, 100, VIEWPORT), true);
  assert.equal(didDragLeaveViewport(100, 600, VIEWPORT), true);
  assert.equal(didDragLeaveViewport(-4, 100, VIEWPORT), true);
});

test('Escape cancels the overlay and other keys do not', () => {
  assert.equal(isDropOverlayCancelKey('Escape'), true);
  assert.equal(isDropOverlayCancelKey('Enter'), false);
  assert.equal(isDropOverlayCancelKey('Esc'), false);
});
