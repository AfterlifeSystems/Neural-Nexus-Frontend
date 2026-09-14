import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  COMPUTER_DECISION_DONE,
  COMPUTER_DECISION_SKIP,
  COMPUTER_HANDOFF_INTERRUPT_KIND,
  computerCardStage,
  computerPreviewSource,
  isComputerHandoffCard,
  settledComputerCard,
} from './computerHandoff.js';

const actionNeeded = {
  kind: COMPUTER_HANDOFF_INTERRUPT_KIND,
  task: 'Sign in to Cursor (Google/GitHub/email + any 2FA), then hand back',
  preview_frame: 'abc123',
  providers_waiting: ['cursor', 'claude_app'],
  status: 'action_needed',
  pending: true,
};

test('the computer card is distinct from a connect_account card', () => {
  assert.equal(isComputerHandoffCard(actionNeeded), true);
  assert.equal(isComputerHandoffCard({ kind: 'connect_account' }), false);
  assert.equal(computerCardStage(actionNeeded), 'action_needed');
});

test('the live preview uses a jpeg data URL', () => {
  assert.equal(computerPreviewSource(actionNeeded), 'data:image/jpeg;base64,abc123');
  assert.equal(computerPreviewSource({ preview_frame: 'data:image/jpeg;base64,xyz' }), 'data:image/jpeg;base64,xyz');
  assert.equal(computerPreviewSource({}), '');
});

test("I'm done settles to Done; Skip advances without credentials", () => {
  const done = settledComputerCard(actionNeeded, COMPUTER_DECISION_DONE);
  assert.equal(done.status, 'done');
  assert.equal(done.pending, false);
  assert.equal(computerCardStage(done), 'done');
  const skipped = settledComputerCard(actionNeeded, COMPUTER_DECISION_SKIP);
  assert.equal(skipped.status, 'skipped');
  assert.equal(computerCardStage(skipped), 'skipped');
  assert.equal(done.password, undefined);
  assert.equal(skipped.token, undefined);
});
