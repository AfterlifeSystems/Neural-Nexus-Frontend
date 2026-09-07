import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  emptyAvatarPreferences,
  feedbackForMessage,
  noticeDecisionFor,
  noticeRatingForAmbientDecision,
  normalizeAvatarPreferences,
  storedMessageIdOf,
  withStoredFeedback,
} from './avatarPreferences.js';

const payload = {
  message_feedback: [
    {
      message_id: 'lc_run--1',
      request_id: 'req-1',
      thread_id: 't1',
      feedback: { type: 'like', comment: 'more of this' },
    },
    { message_id: null, request_id: 'req-2', feedback: { type: 'dislike' } },
    { message_id: 'lc_run--3', request_id: null, feedback: null },
  ],
  ambient_decisions: [
    {
      observation_id: 'obs-1',
      rating: 'ignore',
      note: 'only fires',
      action_taken: 'owner_replied',
      rated_after_action: null,
      left_alone: false,
    },
    { observation_id: 'obs-2', rating: null, note: 'a note alone' },
  ],
};

test('a stored rating is found by stored id first, then by request id', () => {
  const preferences = normalizeAvatarPreferences(payload);
  assert.deepEqual(
    feedbackForMessage(preferences, { id: 'lc_run--1', stored_id: 'lc_run--1' }),
    { type: 'like', comment: 'more of this' }
  );
  assert.deepEqual(
    feedbackForMessage(preferences, { id: 'client-7', request_id: 'req-2' }),
    { type: 'dislike', comment: null }
  );
  assert.equal(feedbackForMessage(preferences, { id: 'lc_run--3' }), null);
  assert.equal(feedbackForMessage(emptyAvatarPreferences(), { id: 'x' }), null);
});

test('the stored id is only what the server named', () => {
  assert.equal(storedMessageIdOf({ id: 'client-7' }), null);
  assert.equal(storedMessageIdOf({ id: 'client-7', stored_id: 'lc_run--9' }), 'lc_run--9');
  assert.equal(storedMessageIdOf(null), null);
});

test('stored ratings replace the bubble state and leave unrated rows alone', () => {
  const preferences = normalizeAvatarPreferences(payload);
  const unrated = { id: 'h1', type: 'human', content: 'hi' };
  const pending = { id: 'c9', type: 'ai', feedback: { type: 'like' } };
  const stale = {
    id: 'c1',
    stored_id: 'lc_run--1',
    type: 'ai',
    feedback: { type: 'dislike', comment: null },
  };
  const messages = [unrated, pending, stale];
  const merged = withStoredFeedback(messages, preferences);
  assert.notEqual(merged, messages);
  assert.equal(merged[0], unrated);
  assert.equal(merged[1], pending);
  assert.deepEqual(merged[2].feedback, { type: 'like', comment: 'more of this' });
  // Nothing to change: the same array comes back, so React does not re-render.
  assert.equal(withStoredFeedback(merged, preferences), merged);
});

test('a card decision lights the matching thumb and keeps its note', () => {
  const preferences = normalizeAvatarPreferences(payload);
  assert.deepEqual(
    noticeDecisionFor(preferences, { ambient: { observation_id: 'obs-1' } }),
    {
      rating: 'dislike',
      note: 'only fires',
      actionTaken: 'owner_replied',
      ratedAfterAction: null,
      leftAlone: false,
    }
  );
  assert.deepEqual(
    noticeDecisionFor(preferences, { ambient: { observation_id: 'obs-2' } }),
    {
      rating: null,
      note: 'a note alone',
      actionTaken: null,
      ratedAfterAction: null,
      leftAlone: false,
    }
  );
  assert.equal(noticeDecisionFor(preferences, { ambient: {} }), null);
  assert.equal(noticeRatingForAmbientDecision('accept'), 'like');
  assert.equal(noticeRatingForAmbientDecision('response'), null);
});
