// src/services/avatarPreferences.js
//
// What the person has told one avatar through thumbs and notes, as the API
// stores it per user and avatar: a rating on each reply and a decision on
// each notification card. The browser reads this on open and again after
// every press, so a thumb that is lit is a thumb that is stored — a page
// refresh shows the same state, not a blank row.

/**
 * The empty preference set, before anything has loaded.
 *
 * @returns {Object}
 */
export function emptyAvatarPreferences() {
  return {
    messageFeedbackByMessageId: {},
    messageFeedbackByRequestId: {},
    ambientDecisionsByObservationId: {},
    // What the avatar has learned about the person: dictated and inferred
    // preferences, written feedback messages, and what feels real or off.
    learnedPreferences: [],
    feedbackMessages: [],
    whatFeelsReal: [],
  };
}

/**
 * Index the `GET /avatar_preferences/{assistant_id}` payload for lookup.
 *
 * @param {Object|null|undefined} payload `{message_feedback, ambient_decisions}`.
 * @returns {Object} See `emptyAvatarPreferences`.
 */
export function normalizeAvatarPreferences(payload) {
  const preferences = emptyAvatarPreferences();
  for (const record of payload?.message_feedback ?? []) {
    const feedback = record?.feedback;
    if (!feedback?.type && !feedback?.feels && !feedback?.comment) continue;
    const view = {
      type: feedback.type ?? null,
      // What the person said this reply feels like: `feels_real`, `feels_fake`,
      // or null when the person only rated or noted the reply.
      feels: feedback.feels ?? null,
      comment: feedback.comment ?? null,
    };
    if (record.message_id) {
      preferences.messageFeedbackByMessageId[String(record.message_id)] = view;
    }
    if (record.request_id) {
      preferences.messageFeedbackByRequestId[String(record.request_id)] = view;
    }
  }
  for (const decision of payload?.ambient_decisions ?? []) {
    if (!decision?.observation_id) continue;
    preferences.ambientDecisionsByObservationId[
      String(decision.observation_id)
    ] = {
      rating: noticeRatingForAmbientDecision(decision.rating),
      note: decision.note ?? null,
      // Who acted on the card: `avatar_replied` (the person allowed the
      // avatar's offer) or `owner_replied` (the person replied in person).
      actionTaken: decision.action_taken ?? null,
      // The thumb on the avatar's reply after the avatar was allowed to act.
      ratedAfterAction: decision.rated_after_action ?? null,
      leftAlone: Boolean(decision.left_alone),
    };
  }
  preferences.learnedPreferences = Array.isArray(payload?.learned_preferences)
    ? payload.learned_preferences
    : [];
  preferences.feedbackMessages = Array.isArray(payload?.feedback_messages)
    ? payload.feedback_messages
    : [];
  preferences.whatFeelsReal = Array.isArray(payload?.what_feels_real)
    ? payload.what_feels_real
    : [];
  return preferences;
}

/**
 * The id a reply is stored under on the server, when the browser knows it.
 *
 * A reloaded transcript row carries its stored id as `id`; a reply that
 * streamed in this session learns its stored id from the terminal frame and
 * keeps it as `stored_id` beside the client id the bubble was keyed on.
 *
 * @param {Object|null|undefined} message
 * @returns {string|null}
 */
export function storedMessageIdOf(message) {
  const storedId = message?.stored_id;
  if (storedId != null && storedId !== '') return String(storedId);
  return null;
}

/**
 * The stored rating for one reply, or null when nobody rated it.
 *
 * @param {Object} preferences See `emptyAvatarPreferences`.
 * @param {Object|null|undefined} message A transcript row.
 * @returns {{type: string|null, feels: string|null, comment: string|null}|null}
 */
export function feedbackForMessage(preferences, message) {
  if (!preferences || !message) return null;
  const storedId = storedMessageIdOf(message);
  if (storedId && preferences.messageFeedbackByMessageId[storedId]) {
    return preferences.messageFeedbackByMessageId[storedId];
  }
  const requestId = message.request_id;
  if (requestId && preferences.messageFeedbackByRequestId[String(requestId)]) {
    return preferences.messageFeedbackByRequestId[String(requestId)];
  }
  return null;
}

/**
 * Put the stored rating on every reply that has one.
 *
 * A stored rating replaces what the bubble was showing: after a press the
 * server is refreshed and what is stored is what is shown. A reply with no
 * stored rating keeps whatever the bubble already had (a press whose save is
 * still in flight).
 *
 * @param {Array} messages The open transcript.
 * @param {Object} preferences See `emptyAvatarPreferences`.
 * @returns {Array} The same rows, with `feedback` filled in.
 */
export function withStoredFeedback(messages, preferences) {
  let changed = false;
  const next = (messages ?? []).map((message) => {
    const stored = feedbackForMessage(preferences, message);
    if (!stored) return message;
    const current = message.feedback;
    if (
      (current?.type ?? null) === (stored.type ?? null) &&
      (current?.feels ?? null) === (stored.feels ?? null) &&
      (current?.comment ?? null) === (stored.comment ?? null)
    ) {
      return message;
    }
    changed = true;
    return { ...message, feedback: stored };
  });
  return changed ? next : messages;
}

/**
 * The thumb a notice card's stored decision lights: accept is like, ignore is
 * dislike, anything else (a note alone) lights nothing.
 *
 * @param {string|null|undefined} decision `accept` | `ignore` | null.
 * @returns {'like'|'dislike'|null}
 */
export function noticeRatingForAmbientDecision(decision) {
  if (decision === 'accept') return 'like';
  if (decision === 'ignore') return 'dislike';
  return null;
}

/**
 * The stored decision on one notification card, or null when nobody decided.
 *
 * @param {Object} preferences See `emptyAvatarPreferences`.
 * @param {Object|null|undefined} message The notice.
 * @returns {{rating: 'like'|'dislike'|null, note: string|null, actionTaken: string|null, ratedAfterAction: string|null, leftAlone: boolean}|null}
 */
export function noticeDecisionFor(preferences, message) {
  const observationId = message?.ambient?.observation_id;
  if (!preferences || !observationId) return null;
  return (
    preferences.ambientDecisionsByObservationId[String(observationId)] ?? null
  );
}
