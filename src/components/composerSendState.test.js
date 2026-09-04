import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composerHasSendableDraft } from './composerSendState.js';

test('empty composer offers voice mode even when a share is live', () => {
  assert.equal(composerHasSendableDraft('', 0), false);
  assert.equal(composerHasSendableDraft('   ', 0), false);
  assert.equal(composerHasSendableDraft(null, 0), false);
});

test('typed text or an attached file is a message worth sending', () => {
  assert.equal(composerHasSendableDraft('hello', 0), true);
  assert.equal(composerHasSendableDraft('', 1), true);
  assert.equal(composerHasSendableDraft('hello', 2), true);
});
