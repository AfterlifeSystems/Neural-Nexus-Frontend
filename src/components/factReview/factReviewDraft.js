// src/components/factReview/factReviewDraft.js
//
// The in-progress choices on a paused fact-review panel.
//
// The panel mounts in two places — the typed transcript and the voice stage —
// and switching between them remounts it. The draft lives on the pending
// interrupt in conversation context so those choices, and whether the panel is
// folded away, survive the remount. Folding is how someone in the middle of a
// conversation puts the review aside and comes back to it later, here or in
// avatar settings.

const KNOWN_ACTIONS = ['accept', 'remove', 'skip'];

/**
 * Seed one card's decision from the interrupt's recommendation.
 *
 * @param {Object} match One entry from the interrupt's `matches`.
 * @returns {{action: string, correctedText: string, correctedContext: string}}
 */
export function seedFactReviewDecision(match) {
  const recommended = KNOWN_ACTIONS.includes(match?.recommended_action)
    ? match.recommended_action
    : 'skip';
  return {
    action: recommended,
    correctedText: match?.suggested_edit_fact_content ?? '',
    correctedContext: match?.suggested_edit_fact_context ?? '',
  };
}

/**
 * Seed every card on a pause. An unrecognized recommendation falls back to
 * skip rather than to whatever happens to be first in the list.
 *
 * @param {Array} matches The interrupt's `matches`.
 * @returns {Object} Keyed by match index.
 */
export function seedFactReviewDecisions(matches) {
  const seeded = {};
  for (const match of matches ?? []) {
    seeded[match.index] = seedFactReviewDecision(match);
  }
  return seeded;
}

/**
 * A fresh draft for one pause. Starts folded so a conversation is not forced
 * through the form; expanding it is the review, not opening the panel.
 *
 * @param {Object} [interrupt] The interrupt payload.
 * @returns {{collapsed: boolean, isConfirmingRemovals: boolean, decisions: Object}}
 */
export function createFactReviewDraft(interrupt) {
  return {
    collapsed: true,
    isConfirmingRemovals: false,
    decisions: seedFactReviewDecisions(interrupt?.matches),
  };
}

/**
 * Attach a draft when this pause is a fact review and does not already have one.
 *
 * A second set of the same pending interrupt — restoring after a failed resume,
 * for example — must not wipe choices the person already made.
 *
 * @param {Object|null} pending The pending interrupt record.
 * @returns {Object|null}
 */
export function attachFactReviewDraft(pending) {
  if (!pending) return pending;
  if (pending.factReviewDraft) return pending;
  const matches = pending.interrupt?.matches;
  if (!Array.isArray(matches) || matches.length === 0) return pending;
  return {
    ...pending,
    factReviewDraft: createFactReviewDraft(pending.interrupt),
  };
}

/**
 * Merge a patch into a draft. `decisions` is replaced when provided, not
 * shallow-merged per card; callers that change one card pass the full map.
 *
 * @param {Object} draft The current draft.
 * @param {Object} patch Fields to overwrite.
 * @returns {Object}
 */
export function patchFactReviewDraft(draft, patch) {
  return { ...createFactReviewDraft(null), ...draft, ...patch };
}

/**
 * Change one card's decision and clear a half-finished removal confirmation.
 *
 * @param {Object} draft The current draft.
 * @param {number|string} index The match index.
 * @param {Object} patch Fields to merge onto that card.
 * @returns {Object}
 */
export function patchFactReviewDecision(draft, index, patch) {
  const current = draft ?? createFactReviewDraft(null);
  const previous = current.decisions?.[index] ?? {
    action: 'skip',
    correctedText: '',
    correctedContext: '',
  };
  return {
    ...current,
    isConfirmingRemovals: false,
    decisions: {
      ...current.decisions,
      [index]: { ...previous, ...patch },
    },
  };
}

/**
 * The resume payload for the current choices. Any match not named is skipped
 * by the server; this still names them all so a folded panel's recommendations
 * are what get applied.
 *
 * @param {Array} matches The interrupt's `matches`.
 * @param {Object} [decisions] Keyed by match index.
 * @returns {Array}
 */
export function factReviewResumeItems(matches, decisions) {
  return (matches ?? []).map((match) => ({
    index: match.index,
    action: decisions?.[match.index]?.action ?? 'skip',
    corrected_text: decisions?.[match.index]?.correctedText ?? '',
    correction_context: decisions?.[match.index]?.correctedContext ?? '',
  }));
}

/**
 * Skip every match, so the turn can continue and the review waits.
 *
 * @param {Array} matches The interrupt's `matches`.
 * @returns {Array}
 */
export function skipAllFactReviewItems(matches) {
  return (matches ?? []).map((match) => ({
    index: match.index,
    action: 'skip',
    corrected_text: '',
    correction_context: '',
  }));
}

/**
 * Where avatar settings should scroll for this kind of pause.
 *
 * @param {string} [correctionKind] The interrupt's `correction_kind`.
 * @returns {'research'|'facts'}
 */
export function settingsSectionForFactReview(correctionKind) {
  return correctionKind === 'research_verification' ? 'research' : 'facts';
}

/**
 * The one line on a folded panel, pointing at the two places the review can
 * be finished later.
 *
 * @param {Object} parameters
 * @param {string} [parameters.correctionKind]
 * @param {number} parameters.matchCount
 * @returns {string}
 */
export function collapsedFactReviewSummary({ correctionKind, matchCount }) {
  const count = Number.isFinite(matchCount) ? matchCount : 0;
  const plural = count === 1 ? '' : 's';
  if (correctionKind === 'research_verification') {
    return `${count} researched fact${plural} can wait — finish ${
      count === 1 ? 'it' : 'them'
    } later in this conversation or in avatar settings.`;
  }
  return `${count} stored item${plural} can wait — finish ${
    count === 1 ? 'it' : 'them'
  } later in this conversation or in avatar settings.`;
}
