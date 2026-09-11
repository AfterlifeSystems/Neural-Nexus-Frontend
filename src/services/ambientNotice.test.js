import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  COLLAPSE_NOTICE_TOOLTIP,
  DISLIKE_NOTICE_TOOLTIP,
  DISMISS_NOTICE_TOOLTIP,
  EXPAND_NOTICE_TOOLTIP,
  IGNORE_NOTICE_TOOLTIP,
  LIKE_NOTICE_TOOLTIP,
  ambientPreferenceForNoticeRating,
  ambientActionFields,
  ambientPreferencePayload,
  isAmbientNotice,
  isAvatarOnBehalfAction,
  isNoticeDismissed,
  loadDismissedNoticeIds,
  noticeDismissId,
  noticeHasSomethingToReplyTo,
  noticeOffer,
  noticePreview,
  noticeShowsIgnoreAction,
  offerVerb,
  noticeWasDecided,
  noticeClickTogglesCard,
  persistDismissedNoticeIds,
  ratedObservationOf,
} from './ambientNotice.js';

test('notice thumbs use the same more/less wording as message feedback', () => {
  assert.equal(LIKE_NOTICE_TOOLTIP, 'Show more notifications like this');
  assert.equal(DISLIKE_NOTICE_TOOLTIP, 'Show less notifications like this');
  assert.equal(ambientPreferenceForNoticeRating('like').type, 'accept');
  assert.equal(ambientPreferenceForNoticeRating('dislike').type, 'ignore');
});

test('only a notify decision is a notice', () => {
  assert.equal(
    isAmbientNotice({ ambient: { decision: 'notify' } }),
    true
  );
  assert.equal(
    isAmbientNotice({ ambient: { decision: 'respond' } }),
    false
  );
  assert.equal(isAmbientNotice({ ambient: { decision: 'ignore' } }), false);
  assert.equal(isAmbientNotice({ content: 'hello' }), false);
  assert.equal(isAmbientNotice(null), false);
});

test('like and dislike map onto the preference decisions the API stores', () => {
  assert.deepEqual(ambientPreferenceForNoticeRating('like'), {
    type: 'accept',
    args: null,
  });
  assert.deepEqual(ambientPreferenceForNoticeRating('dislike'), {
    type: 'ignore',
    args: null,
  });
  assert.equal(ambientPreferenceForNoticeRating('dismiss'), null);
});

test('folding a notice is hide/show, not a preference', () => {
  assert.equal(COLLAPSE_NOTICE_TOOLTIP, 'Hide this notice');
  assert.equal(EXPAND_NOTICE_TOOLTIP, 'Show this notice');
  assert.equal(DISMISS_NOTICE_TOOLTIP, 'Dismiss this notice');
});

test('a click on the card body folds it; a click on a control does not', () => {
  const card = { contains: () => false };
  assert.equal(
    noticeClickTogglesCard({
      target: { closest: () => null },
      currentTarget: card,
    }),
    true
  );
  assert.equal(
    noticeClickTogglesCard({
      target: {
        closest: (selector) => (selector.includes('button') ? {} : null),
      },
      currentTarget: card,
    }),
    false
  );
  assert.equal(
    noticeClickTogglesCard({
      target: {
        closest: (selector) => (selector.includes('input') ? {} : null),
      },
      currentTarget: card,
    }),
    false
  );
});

test('a folded notice shows the summary, else the first line of the heads-up', () => {
  assert.equal(
    noticePreview({
      content: 'I noticed your Thunderbird inbox is open.',
      ambient: { summary: 'Thunderbird shows an inbox with invoices.' },
    }),
    'Thunderbird shows an inbox with invoices.'
  );
  assert.equal(
    noticePreview({
      content: 'First line\nSecond line',
      ambient: { summary: '  ' },
    }),
    'First line'
  );
  assert.equal(noticePreview({ content: '' }), '');
  assert.equal(noticePreview(null), '');
});

test('the preference payload carries the observation the card answered', () => {
  const message = {
    content: 'I noticed your Thunderbird inbox is open.',
    ambient: {
      decision: 'notify',
      observation_id: 'obs-1',
      observation_kind: 'email_inbox',
      summary:
        'Thunderbird shows an inbox with multiple Stripe/SpaceXAI invoices.',
    },
  };
  assert.deepEqual(
    ambientPreferencePayload(message, { type: 'accept', args: null }),
    {
      observationId: 'obs-1',
      observationKind: 'email_inbox',
      summary:
        'Thunderbird shows an inbox with multiple Stripe/SpaceXAI invoices.',
      type: 'accept',
      args: null,
    }
  );
});

test('a plain heads-up shows ignore, not reply', () => {
  const notice = { ambient: { decision: 'notify', proposed_action: 'none' } };
  assert.equal(noticeShowsIgnoreAction(notice), true);
  assert.equal(noticeHasSomethingToReplyTo(notice), false);
  assert.equal(noticeOffer(notice), null);
  assert.equal(IGNORE_NOTICE_TOOLTIP, 'Ignore notices like this');
});

test('reply is only an offer when the avatar can answer a waiting message', () => {
  assert.equal(
    isAvatarOnBehalfAction('reply', 'Say something useful about the terminal'),
    false
  );
  assert.equal(
    isAvatarOnBehalfAction('explain', 'Explain the close dialog'),
    false
  );
  assert.equal(
    isAvatarOnBehalfAction('cancel', 'Cancel the terminal close prompt'),
    false
  );
  assert.equal(
    isAvatarOnBehalfAction('research', 'Research the error on the screen'),
    true
  );
  assert.equal(
    noticeOffer({
      ambient: {
        decision: 'notify',
        proposed_action: 'reply',
        action_description: 'Say something useful about the terminal',
      },
    }),
    null
  );
  assert.deepEqual(
    noticeOffer({
      ambient: {
        decision: 'notify',
        proposed_action: 'reply',
        action_description: 'Reply to the invoice email',
      },
    }),
    { action: 'reply', description: 'Reply to the invoice email' }
  );
  assert.equal(
    noticeHasSomethingToReplyTo({
      ambient: {
        decision: 'notify',
        proposed_action: 'reply',
        action_description: 'Reply to the invoice email',
      },
    }),
    true
  );
  assert.equal(
    noticeHasSomethingToReplyTo({
      ambient: {
        decision: 'notify',
        proposed_action: 'research',
        action_description: 'Research the error on the screen',
      },
    }),
    false
  );
});

test('an offer is only a notify with an action and wording', () => {
  const offered = {
    ambient: {
      decision: 'notify',
      observation_id: 'obs-1',
      observation_kind: 'email_inbox',
      summary: 'An invoice email is open.',
      proposed_action: 'Draft',
      action_description: 'Draft a reply to the invoice email',
    },
  };
  assert.deepEqual(noticeOffer(offered), {
    action: 'draft',
    description: 'Draft a reply to the invoice email',
  });
  assert.equal(offerVerb('Research the error'), 'research');
  assert.equal(offerVerb('none'), null);
  assert.equal(offerVerb('42'), null);
  assert.equal(
    noticeOffer({ ambient: { decision: 'notify', proposed_action: 'none' } }),
    null
  );
  assert.equal(
    noticeOffer({
      ambient: { decision: 'respond', proposed_action: 'reply', action_description: 'x' },
    }),
    null
  );
  assert.deepEqual(ambientActionFields(offered), {
    ambient_action_observation_id: 'obs-1',
    ambient_action: 'draft',
    ambient_action_description: 'Draft a reply to the invoice email',
    ambient_action_kind: 'email_inbox',
    ambient_action_summary: 'An invoice email is open.',
  });
  assert.equal(ambientActionFields({ ambient: { decision: 'notify' } }), null);
});

test('a rated reply names the observation it answered', () => {
  assert.deepEqual(
    ratedObservationOf({
      ambient: { decision: 'act', observation_id: 'obs-1', observation_kind: 'k', summary: 's' },
    }),
    { observationId: 'obs-1', observationKind: 'k', summary: 's' }
  );
  assert.equal(ratedObservationOf({ content: 'plain reply' }), null);
});

test('a card counts as decided once anything was chosen on it', () => {
  assert.equal(noticeWasDecided(null), false);
  assert.equal(
    noticeWasDecided({ rating: null, note: null, actionTaken: null, ratedAfterAction: null, leftAlone: false }),
    false
  );
  assert.equal(noticeWasDecided({ rating: 'like' }), true);
  assert.equal(noticeWasDecided({ actionTaken: 'avatar_replied' }), true);
  assert.equal(noticeWasDecided({ leftAlone: true }), true);
});

test('a dismissed notice stays off the screen after the stored ids reload', () => {
  const storage = {
    data: {},
    getItem(key) {
      return this.data[key] ?? null;
    },
    setItem(key, value) {
      this.data[key] = value;
    },
  };
  const notice = { id: 'm1', ambient: { observation_id: 'obs-1' } };
  assert.equal(noticeDismissId(notice), 'obs-1');
  persistDismissedNoticeIds(new Set(['obs-1']), storage);
  const loaded = loadDismissedNoticeIds(storage);
  assert.equal(isNoticeDismissed(notice, loaded), true);
  assert.equal(
    isNoticeDismissed({ ambient: { observation_id: 'obs-2' } }, loaded),
    false
  );
  assert.equal(isNoticeDismissed(notice, new Set()), false);
});
