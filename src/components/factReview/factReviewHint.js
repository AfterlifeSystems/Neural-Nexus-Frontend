// src/components/factReview/factReviewHint.js
//
// The one line of advice a fact-review card carries.
//
// Kept out of the card component so the Node test runner can load it, and so
// the wording for each kind of pending change lives in one readable place.

/**
 * The one-line recommendation shown under a card, or null when the card's own
 * suggested edit already is the recommendation.
 *
 * A researched contradiction is never a recommendation to leave things alone.
 * The avatar has no way to tell which version is true, and "I recommend leaving
 * this document unchanged" — said over a fact the avatar does not even hold yet
 * — reads as advice to throw the research away. Say what is actually true: the
 * sources disagreed, and the choice belongs to the avatar's creator.
 *
 * @param {Object} match One entry from the interrupt's `matches`.
 * @returns {string|null} The sentence to show, or null for no hint.
 */
export function recommendationHintFor(match) {
  if (match?.kind === 'research_proposal') {
    return match?.has_stored_fact
      ? 'The sources contradict what this avatar already holds — only you can say which version is true.'
      : 'This avatar holds nothing on this point yet, and the sources disagreed with each other — only you can say whether to keep the researched version.';
  }
  if (match?.recommended_action === 'remove') {
    return 'I recommend removing this document.';
  }
  if (match?.recommended_action === 'accept') {
    return null; // The suggested edit below is the recommendation.
  }
  return 'I recommend leaving this document unchanged.';
}
