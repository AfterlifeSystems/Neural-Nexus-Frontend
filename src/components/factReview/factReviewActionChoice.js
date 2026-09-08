// src/components/factReview/factReviewActionChoice.js
//
// How accept / discard / skip are offered on a fact-review card.
//
// These must be ordinary buttons. A visually-hidden radio (`sr-only` inside
// a <label>) is focused when the pill is clicked, and the browser then
// scrolls every overflow ancestor to that 1×1 clipped box. On avatar
// settings the card sits in the tall Upload section, whose `backdrop-blur`
// is a containing block, so the page jumps to the bottom.

export const ACTION_CHOICE_ELEMENT = 'button';

export const ACTION_CHOICE_BUTTON_TYPE = 'button';

/**
 * Classes for one accept / discard / skip pill.
 *
 * @param {Object} options
 * @param {boolean} options.selected
 * @param {boolean} [options.disabled]
 * @returns {string}
 */
export function actionChoiceButtonClassName({ selected, disabled = false }) {
  const selectedClasses = selected
    ? 'bg-neutral-200 border-neutral-100 text-neutral-900'
    : 'bg-black/60 border-neutral-700 text-white/70 hover:bg-white/10';
  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : '';
  return [
    'text-xs px-3 py-1.5 rounded-full border transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-amber-400/50',
    selectedClasses,
    disabledClasses,
  ]
    .filter(Boolean)
    .join(' ');
}
