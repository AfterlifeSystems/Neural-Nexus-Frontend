import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  OAUTH_CARD_STAGES,
  oauthCardStage,
  oauthOfferLabels,
} from './oauthAuthorizeCard.js';

test('OAuth card copy walks offer → Authorize → waiting/Reopen → Added', () => {
  const labels = oauthOfferLabels('Google Drive');
  assert.equal(labels.add, 'A) Add Google Drive');
  assert.equal(labels.skip, 'B) Skip for now');
  assert.equal(labels.authorize, 'Authorize');
  assert.equal(labels.waiting, 'Waiting for Google Drive authorization…');
  assert.equal(labels.reopen, 'Reopen');
  assert.equal(labels.added, 'Added');
  assert.deepEqual(OAUTH_CARD_STAGES, ['offer', 'authorize', 'waiting', 'added']);
  assert.equal(oauthCardStage({ offered: true }), 'offer');
  assert.equal(oauthCardStage({ authorizing: true }), 'authorize');
  assert.equal(oauthCardStage({ waiting: true }), 'waiting');
  assert.equal(oauthCardStage({ connected: true }), 'added');
});
