// src/services/ambientNotice.js
//
// An ambient notice is the avatar speaking up about something the webcam or
// screen showed — `response_metadata.ambient.decision === "notify"`. Chat
// paints it as a card; voice mode must paint the same card, because the
// thumbs on it are how the next triage learns whether to keep bringing this
// kind of scene up.

/**
 * Whether this avatar turn is a heads-up about something noticed ambiently.
 *
 * @param {Object|null|undefined} message A transcript row.
 * @returns {boolean}
 */
export function isAmbientNotice(message) {
  return message?.ambient?.decision === 'notify';
}

/** Tooltip on thumbs-up: more notices of this kind next time. */
export const LIKE_NOTICE_TOOLTIP = 'Show more notifications like this';

/** Tooltip on thumbs-down: fewer notices of this kind next time. */
export const DISLIKE_NOTICE_TOOLTIP = 'Show less notifications like this';

/** Tooltip on the chevron that hides the card body. Records nothing. */
export const COLLAPSE_NOTICE_TOOLTIP = 'Hide this notice';

/** Tooltip on the chevron that opens a folded card. Records nothing. */
export const EXPAND_NOTICE_TOOLTIP = 'Show this notice';

/** Tooltip on the control that takes the notice off the screen. */
export const DISMISS_NOTICE_TOOLTIP = 'Dismiss this notice';

const DISMISSED_NOTICES_STORAGE_KEY = 'dismissed-ambient-notices';
const DISMISSED_NOTICES_LIMIT = 200;

/**
 * The id used to remember that this notice was taken off the screen.
 *
 * @param {Object|null|undefined} message The notice.
 * @returns {string}
 */
export function noticeDismissId(message) {
  const observationId = message?.ambient?.observation_id;
  if (observationId) return String(observationId);
  if (message?.id != null && message.id !== '') return String(message.id);
  return '';
}

/**
 * Whether this notice has been taken off the screen.
 *
 * @param {Object|null|undefined} message The notice.
 * @param {Set<string>|null|undefined} dismissedIds Ids the person dismissed.
 * @returns {boolean}
 */
export function isNoticeDismissed(message, dismissedIds) {
  const id = noticeDismissId(message);
  return Boolean(id && dismissedIds?.has?.(id));
}

function readableStorage(storage) {
  if (storage) return storage;
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * Dismissed observation ids remembered on this browser.
 *
 * @param {Storage|null} [storage]
 * @returns {Set<string>}
 */
export function loadDismissedNoticeIds(storage) {
  try {
    const raw = readableStorage(storage)?.getItem(DISMISSED_NOTICES_STORAGE_KEY);
    const parsed = JSON.parse(raw);
    return new Set(
      Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : []
    );
  } catch {
    return new Set();
  }
}

/**
 * Persist dismissed observation ids so a refresh does not put the card back.
 *
 * @param {Iterable<string>} ids
 * @param {Storage|null} [storage]
 */
export function persistDismissedNoticeIds(ids, storage) {
  const writable = readableStorage(storage);
  if (!writable) return;
  try {
    const list = [...ids].map(String).filter(Boolean);
    const trimmed =
      list.length > DISMISSED_NOTICES_LIMIT
        ? list.slice(list.length - DISMISSED_NOTICES_LIMIT)
        : list;
    writable.setItem(DISMISSED_NOTICES_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Private mode can refuse storage; the in-memory set still covers this tab.
  }
}

/** Clicks on these stay their own actions instead of folding the card. */
export const NOTICE_CARD_CONTROL_SELECTOR =
  'button, input, textarea, select, a, label';

/**
 * Whether a click on a notice card should fold or unfold it.
 *
 * The card body is the toggle. A control (Ignore, Reply, thumbs, the
 * comment field) keeps its own action. Drag-selecting the heads-up is not
 * a toggle.
 *
 * @param {MouseEvent|null|undefined} event The click on the card.
 * @returns {boolean}
 */
export function noticeClickTogglesCard(event) {
  const target = event?.target;
  if (target?.closest?.(NOTICE_CARD_CONTROL_SELECTOR)) return false;
  const card = event?.currentTarget;
  const selection =
    typeof globalThis.getSelection === 'function'
      ? globalThis.getSelection()
      : null;
  if (
    selection &&
    !selection.isCollapsed &&
    card?.contains?.(selection.anchorNode)
  ) {
    return false;
  }
  return true;
}

/**
 * One-line preview for a folded notice: the triage summary, else the first
 * line of the heads-up.
 *
 * @param {Object|null|undefined} message The notice.
 * @returns {string}
 */
export function noticePreview(message) {
  const summary = String(message?.ambient?.summary ?? '').trim();
  if (summary) return summary;
  const content = String(message?.content ?? '').trim();
  if (!content) return '';
  return content.split(/\r?\n/, 1)[0];
}

/**
 * The Agent Inbox decision a thumbs-up or thumbs-down on a notice records.
 *
 * Like is `accept`: keep telling me about this kind of scene. Dislike is
 * `ignore`: the next similar observation should stay quiet. Both land in the
 * ambient preference store the triage classifier reads as precedent.
 *
 * @param {'like'|'dislike'} rating
 * @returns {{type: 'accept'|'ignore', args: null}|null}
 */
export function ambientPreferenceForNoticeRating(rating) {
  if (rating === 'like') return { type: 'accept', args: null };
  if (rating === 'dislike') return { type: 'ignore', args: null };
  return null;
}

/**
 * The body POST /ambient_preferences/{assistant_id} expects for one card.
 *
 * @param {Object|null|undefined} message The notice.
 * @param {Object} decision `{type, args}`.
 * @returns {Object}
 */
export function ambientPreferencePayload(message, { type, args } = {}) {
  const ambient = message?.ambient ?? {};
  return {
    observationId: ambient.observation_id ?? null,
    observationKind: ambient.observation_kind ?? 'other',
    summary: ambient.summary ?? '',
    type,
    args: args ?? null,
  };
}

/** Tooltip on Ignore: the next similar observation should stay quiet. */
export const IGNORE_NOTICE_TOOLTIP = 'Ignore notices like this';

/** Verbs that mean the avatar would only talk. The heads-up already did that. */
const CONVERSATIONAL_OFFER_VERBS = new Set([
  'advise',
  'comment',
  'explain',
  'mention',
  'note',
  'observe',
  'remark',
  'say',
  'tell',
  'warn',
]);

/** Verbs that mean clicking or typing on this machine. The avatar cannot. */
const LOCAL_MACHINE_OFFER_VERBS = new Set([
  'cancel',
  'click',
  'close',
  'dismiss',
  'press',
  'tap',
  'type',
]);

/** A proposed reply is on-behalf only when the wording names a waiting channel. */
const REPLY_CHANNEL_MARKERS = [
  'call',
  'discord',
  'dm',
  'email',
  'inbox',
  'mail',
  'message',
  'slack',
  'sms',
  'thread',
  'tweet',
];

/**
 * The one verb an offer names, lowercase letters only, or null.
 *
 * "Draft a reply" is `draft`; "none", an empty value, or a value with no
 * letters is null.
 *
 * @param {unknown} value The triage's `proposed_action`.
 * @returns {string|null}
 */
export function offerVerb(value) {
  const firstWord = String(value ?? '')
    .trim()
    .split(' ', 1)[0];
  const verb = firstWord.toLowerCase().replace(/[^a-z]/g, '').slice(0, 20);
  return verb && verb !== 'none' ? verb : null;
}

/**
 * Whether this offer is something the avatar can do for the conversation
 * partner. Talking about what was seen is not an action. Clicking a local
 * dialog is not an action the avatar can take. `reply` counts only when the
 * wording names a waiting message, email, or call.
 *
 * @param {unknown} action The triage's `proposed_action`.
 * @param {unknown} [description] The wording that details the verb.
 * @returns {boolean}
 */
export function isAvatarOnBehalfAction(action, description = '') {
  const verb = offerVerb(action);
  if (!verb) return false;
  if (CONVERSATIONAL_OFFER_VERBS.has(verb)) return false;
  if (LOCAL_MACHINE_OFFER_VERBS.has(verb)) return false;
  if (verb === 'reply') {
    const wording = String(description ?? '').toLowerCase();
    return REPLY_CHANNEL_MARKERS.some((marker) => wording.includes(marker));
  }
  return true;
}

/**
 * What the avatar offered to do about this notice, or null for a plain
 * heads-up. The triage names one verb the avatar will perform on the
 * conversation partner's behalf (`proposed_action`: draft, remind,
 * research ...) and one line of wording detailing the verb; the card puts
 * the verb on the button. A conversational `reply` or a local-dialog verb
 * is not an offer.
 *
 * @param {Object|null|undefined} message The notice.
 * @returns {{action: string, description: string}|null}
 */
export function noticeOffer(message) {
  const ambient = message?.ambient ?? {};
  if (ambient.decision !== 'notify') return null;
  const action = offerVerb(ambient.proposed_action);
  const description = String(ambient.action_description ?? '').trim();
  if (!action || !description) return null;
  if (!isAvatarOnBehalfAction(action, description)) return null;
  return { action, description };
}

/**
 * Whether this notice has a waiting message, email, or call the person or
 * the avatar could answer. A terminal dialog does not.
 *
 * @param {Object|null|undefined} message The notice.
 * @returns {boolean}
 */
export function noticeHasSomethingToReplyTo(message) {
  const offer = noticeOffer(message);
  return Boolean(offer && (offer.action === 'reply' || offer.action === 'draft'));
}

/**
 * Whether a notify card should show Ignore. A plain heads-up has no avatar
 * action, so Ignore is how the person teaches the next triage to stay quiet
 * about this kind of scene.
 *
 * @param {Object|null|undefined} message The notice.
 * @returns {boolean}
 */
export function noticeShowsIgnoreAction(message) {
  return isAmbientNotice(message);
}

/**
 * The form fields that turn an allowed offer into the avatar's next turn.
 * They ride POST /message/{assistant_id}; the server writes the hidden
 * instruction and stamps the reply with this observation.
 *
 * @param {Object|null|undefined} message The notice whose offer was allowed.
 * @returns {Object|null} Field names mapped to values, or null without an offer.
 */
export function ambientActionFields(message) {
  const offer = noticeOffer(message);
  if (!offer) return null;
  const ambient = message?.ambient ?? {};
  if (!ambient.observation_id) return null;
  return {
    ambient_action_observation_id: String(ambient.observation_id),
    ambient_action: offer.action,
    ambient_action_description: offer.description,
    ambient_action_kind: ambient.observation_kind ?? 'other',
    ambient_action_summary: ambient.summary ?? '',
  };
}

/**
 * The observation a rated reply belongs to, so a thumb on the reply is also
 * learned as precedent for that kind of scene. Only replies that carry an
 * observation (a heads-up, a reply the avatar chose to make, an allowed
 * action) have one.
 *
 * @param {Object|null|undefined} message The rated reply.
 * @returns {{observationId: string, observationKind: string, summary: string}|null}
 */
export function ratedObservationOf(message) {
  const ambient = message?.ambient ?? {};
  if (!ambient.observation_id) return null;
  return {
    observationId: String(ambient.observation_id),
    observationKind: ambient.observation_kind ?? 'other',
    summary: ambient.summary ?? '',
  };
}

/**
 * Whether the person has done anything with this card: a thumb, a note, an
 * action, or a rating on the avatar's action. A card with none of these when
 * the person moves on is recorded as left alone.
 *
 * @param {{rating: string|null, note: string|null, actionTaken: string|null, ratedAfterAction: string|null, leftAlone: boolean}|null|undefined} decision
 * @returns {boolean}
 */
export function noticeWasDecided(decision) {
  if (!decision) return false;
  return Boolean(
    decision.rating ||
      decision.note ||
      decision.actionTaken ||
      decision.ratedAfterAction ||
      decision.leftAlone
  );
}
