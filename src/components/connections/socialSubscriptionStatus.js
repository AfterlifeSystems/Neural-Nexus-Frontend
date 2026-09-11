// src/components/connections/socialSubscriptionStatus.js

/**
 * How one connected account's subscription state reads to its owner.
 *
 * Kept apart from the component because the judgement here is the part worth
 * testing and the part easiest to get subtly wrong. A connected account can be
 * switched on and still be contributing nothing — because nobody proved it is
 * the owner's, because its platform announces nothing, or because a lease
 * lapsed — and those three produce very different advice. Collapsing them into
 * one "connected" pill is exactly the failure this module exists to prevent.
 */

export const OWNERSHIP_PROVEN = 'proven';

/** How each platform tells us, phrased for someone who did not design it. */
export const TRANSPORT_LABELS = {
  websub: 'The platform notifies us the moment you publish',
  eventsub: 'The platform notifies us the moment you go live',
  meta_graph: 'The platform notifies us the moment you post',
  email_notification: 'Read from the notification emails this platform sends you',
  none: 'This platform offers no way to announce new posts',
};

export const SUBSCRIPTION_LABELS = {
  active: 'Subscribed',
  pending: 'Waiting for the platform to confirm',
  expired: 'Lapsed — renewing',
  failed: 'Could not subscribe',
  disabled: 'Paused',
};

/**
 * Describe one account row: its pills, its explanation, and its offered action.
 *
 * @param {Object} row A row from `GET /social_subscriptions`.
 * @returns {{proven: boolean, subscribed: boolean, pills: Array, explanation: string, action: string|null}}
 */
export const describeSubscriptionRow = (row = {}) => {
  const proven = row.ownership_state === OWNERSHIP_PROVEN;
  const subscribed = row.subscription_status === 'active';
  const pills = [];

  pills.push(
    proven
      ? { tone: 'good', text: 'Verified yours' }
      : { tone: 'warn', text: 'Not verified' },
  );

  if (proven && subscribed) {
    pills.push({ tone: 'good', text: SUBSCRIPTION_LABELS.active });
  } else if (proven && row.subscription_status) {
    pills.push({
      tone: 'neutral',
      text:
        SUBSCRIPTION_LABELS[row.subscription_status] || row.subscription_status,
    });
  }

  if (proven && row.subscribable === false) {
    pills.push({ tone: 'neutral', text: 'No new-post alerts' });
  }

  // An unproven account's explanation is its reason, never its transport: how
  // the platform would announce is irrelevant while nothing it announces will
  // be used at all.
  const explanation = proven
    ? TRANSPORT_LABELS[row.content_transport] || TRANSPORT_LABELS.none
    : row.ownership_detail ||
      'Nothing from this account will be used until it is verified.';

  return {
    proven,
    subscribed,
    pills,
    explanation,
    action: proven ? 'pull_more' : 'verify',
  };
};

/**
 * Summarise the whole panel in one line, for a collapsed heading.
 *
 * @param {Array} rows Rows from `GET /social_subscriptions`.
 * @returns {string} A sentence, or an invitation when there is nothing yet.
 */
export const summariseSubscriptions = (rows = []) => {
  if (rows.length === 0) {
    return 'No accounts connected yet.';
  }
  const live = rows.filter(
    (row) =>
      row.ownership_state === OWNERSHIP_PROVEN &&
      row.subscription_status === 'active',
  ).length;
  const unverified = rows.filter(
    (row) => row.ownership_state !== OWNERSHIP_PROVEN,
  ).length;

  const parts = [];
  parts.push(
    live === 1
      ? '1 account keeping your avatar current'
      : `${live} accounts keeping your avatar current`,
  );
  if (unverified > 0) {
    parts.push(
      unverified === 1
        ? '1 still to verify'
        : `${unverified} still to verify`,
    );
  }
  return `${parts.join(' · ')}.`;
};
