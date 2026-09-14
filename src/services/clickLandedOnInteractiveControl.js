// A card can be a control and still hold links or buttons of its own.
// Those inner controls keep their own action; only a press that missed
// every one of them belongs to the card.

const INTERACTIVE_CONTROL_SELECTOR = 'a, button, iframe, [role="button"]';

/**
 * Whether this click landed on a link, button, frame, or something that
 * already has a button role.
 *
 * @param {Event|null|undefined} clickEvent
 * @returns {boolean}
 */
export function clickLandedOnInteractiveControl(clickEvent) {
  const target = clickEvent?.target;
  if (!target || typeof target.closest !== 'function') return false;
  return Boolean(target.closest(INTERACTIVE_CONTROL_SELECTOR));
}
