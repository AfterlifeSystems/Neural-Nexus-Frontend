// src/services/composerFocus.js
//
// Reply on a notice is "talk about this": it has to land in the composer the
// person can actually type or speak into. A generic `textarea` query picked
// hidden or unrelated fields (and missed the voice-mode text input entirely).

export const COMPOSER_INPUT_SELECTOR = '[data-composer-input]';

/**
 * Move keyboard focus to the on-screen composer.
 *
 * @param {ParentNode|null|undefined} [root] Document or a subtree to search.
 * @returns {boolean} True when a composer was focused.
 */
export function focusComposer(root = globalThis.document) {
  const composer = root?.querySelector?.(COMPOSER_INPUT_SELECTOR);
  if (!composer || composer.disabled) return false;
  composer.focus();
  if (typeof composer.scrollIntoView === 'function') {
    composer.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  return true;
}
