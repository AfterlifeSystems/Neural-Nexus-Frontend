/**
 * Copy and stages for the in-chat OAuth Authorize card (Path A).
 *
 * Offer A/B → compact Authorize → Waiting + Reopen → Added + tool count.
 */

export const OAUTH_CARD_STAGES = ['offer', 'authorize', 'waiting', 'added'];

export function oauthOfferLabels(displayName) {
  const name = displayName || 'this account';
  return {
    add: `A) Add ${name}`,
    skip: 'B) Skip for now',
    installing: `Installing ${name} now.`,
    authorize: 'Authorize',
    waiting: `Waiting for ${name} authorization…`,
    reopen: 'Reopen',
    added: 'Added',
  };
}

export function oauthCardStage({ offered = false, authorizing = false, waiting = false, connected = false } = {}) {
  if (connected) return 'added';
  if (waiting) return 'waiting';
  if (authorizing) return 'authorize';
  if (offered) return 'offer';
  return 'offer';
}
