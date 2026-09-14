import {
  CARD_STATUS_ACTION_NEEDED,
  CARD_STATUS_DONE,
  CARD_STATUS_SKIPPED,
  COMPUTER_HANDOFF_INTERRUPT_KIND,
} from './connectionCards.js';

export { COMPUTER_HANDOFF_INTERRUPT_KIND };

export const COMPUTER_DECISION_TAKEOVER = 'takeover';
export const COMPUTER_DECISION_DONE = 'done';
export const COMPUTER_DECISION_SKIP = 'skip';

/**
 * Whether a card or interrupt is the agent-computer handoff.
 *
 * @param {Object} card
 * @returns {boolean}
 */
export function isComputerHandoffCard(card) {
  return card?.kind === COMPUTER_HANDOFF_INTERRUPT_KIND;
}

/**
 * Preview image source for the live Computer card frame.
 *
 * @param {Object} card
 * @returns {string}
 */
export function computerPreviewSource(card) {
  const frame = card?.preview_frame;
  if (!frame) return '';
  if (String(frame).startsWith('data:')) return String(frame);
  return `data:image/jpeg;base64,${frame}`;
}

/**
 * Settle a Computer card after I'm done or Skip.
 *
 * @param {Object} card
 * @param {'done'|'skip'} decision
 * @returns {Object}
 */
export function settledComputerCard(card, decision) {
  if (decision === COMPUTER_DECISION_SKIP) {
    return {
      ...card,
      status: CARD_STATUS_SKIPPED,
      pending: false,
    };
  }
  return {
    ...card,
    status: CARD_STATUS_DONE,
    pending: false,
  };
}

/**
 * Stages the Computer card walks through in chat.
 *
 * @param {Object} card
 * @returns {'action_needed'|'done'|'skipped'}
 */
export function computerCardStage(card) {
  if (card?.status === CARD_STATUS_DONE) return 'done';
  if (card?.status === CARD_STATUS_SKIPPED) return 'skipped';
  return CARD_STATUS_ACTION_NEEDED;
}
