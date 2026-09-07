// src/components/interruptHeading.js
//
// What the human-in-the-loop panel says at the top. The same panel resolves two
// different pauses — a correction the person asked for, and a contradiction the
// research turned up — and each needs its own sentence: one is "here is what I
// found that matches what you flagged", the other is "the sources disagree with
// what I hold, which is true?".
//
// Pure, so the Node test runner can load it.

/**
 * The panel's heading and sub-line for one pause.
 *
 * @param {Object} parameters
 * @param {string} [parameters.correctionKind] The interrupt's kind.
 * @param {number} parameters.matchCount How many items the panel is showing.
 * @returns {{heading: string, guidance: string}}
 */
export function interruptHeadingFor({ correctionKind, matchCount }) {
  const count = Number.isFinite(matchCount) ? matchCount : 0;
  const plural = count === 1 ? '' : 's';

  if (correctionKind === 'research_verification') {
    return {
      heading: `🔎 The research found ${count} fact${plural} that contradict${
        count === 1 ? 's' : ''
      } what I hold — choose which version is true.`,
      guidance:
        'Everything the sources agreed on is already learned. Only these needed you, because nobody else can say which version is right. Anything you leave alone keeps waiting.',
    };
  }

  return {
    heading: `✏️ I found ${count} stored item${plural} that might match — choose what to do with each.`,
    guidance:
      'Each item is pre-selected to my recommendation; you can change any of them. Anything I recommend leaving unchanged stays exactly as-is unless you pick another action.',
  };
}
