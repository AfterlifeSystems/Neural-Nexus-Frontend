// src/components/factReview/researchProposalCard.js
//
// A researched contradiction, in the shape the fact-review card renders.
//
// The avatar raises these two ways — as a pause in the conversation, where the
// API sends the card shape directly, and as a list in avatar settings, which
// reads the raw proposals. This maps the second onto the first so both surfaces
// show the same control, worded the same way.
//
// Pure, so the Node test runner can load it.

/**
 * One proposal as a fact-review card.
 *
 * @param {number} index Position in the list; correlates a decision back.
 * @param {Object} proposal A row from GET /avatar/{id}/research/proposals.
 * @returns {Object} The card shape.
 */
export function researchProposalAsCard(index, proposal) {
  const sources = (proposal?.supporting_source_urls ?? []).filter(Boolean);
  const statements = (proposal?.conflicting_statements ?? []).filter(Boolean);
  const excerpt = [
    proposal?.reasoning,
    statements.length ? `Sources said: ${statements.slice(0, 4).join(' | ')}` : '',
    sources.length ? `Sources: ${sources.slice(0, 4).join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    index,
    kind: 'research_proposal',
    namespace: [],
    key: proposal?.fact_id,
    document_id: proposal?.fact_id,
    current_fact_content:
      proposal?.existing_fact || '(nothing stored yet on this point)',
    // Whether the avatar holds anything on this point at all. A contradiction
    // between the sources and a stored fact and a contradiction among the
    // sources alone are different decisions, and the card says so.
    has_stored_fact: Boolean(proposal?.existing_fact),
    current_fact_context: proposal?.fact_context ?? '',
    document_excerpt: excerpt.slice(0, 1000),
    suggested_edit_fact_content: proposal?.fact ?? '',
    suggested_edit_fact_context: proposal?.fact_context ?? '',
    default_action: 'skip',
    // Nobody but the owner can say which version is true, so nothing is
    // pre-selected for them.
    recommended_action: 'skip',
    verification_status: proposal?.verification_status,
    source_urls: sources,
  };
}

/** The wording the review actions carry for a researched contradiction. */
export const RESEARCH_ACTION_LABELS = {
  accept: 'Use the researched version',
  remove: 'Discard the researched fact',
  skip: 'Decide later',
};

/**
 * The decisions the settings list collected, as the resolve endpoint wants them.
 *
 * Anything left on "skip" is omitted entirely, so a contradiction the owner did
 * not act on keeps waiting rather than being silently resolved.
 *
 * @param {Array} proposals The proposals shown.
 * @param {Object} decisions Keyed by card index: {action, correctedText}.
 * @returns {Array} Items for resolveResearchProposals.
 */
export function buildProposalResolutions(proposals, decisions) {
  const items = [];
  (proposals ?? []).forEach((proposal, index) => {
    const decision = decisions?.[index];
    const action = decision?.action ?? 'skip';
    if (!proposal?.fact_id || action === 'skip') return;
    if (action === 'remove') {
      items.push({ fact_id: proposal.fact_id, action: 'ignore' });
      return;
    }
    const corrected = (decision?.correctedText ?? '').trim();
    const researched = (proposal.fact ?? '').trim();
    if (corrected && corrected !== researched) {
      items.push({
        fact_id: proposal.fact_id,
        action: 'edit',
        corrected_text: corrected,
      });
    } else {
      items.push({ fact_id: proposal.fact_id, action: 'accept' });
    }
  });
  return items;
}
