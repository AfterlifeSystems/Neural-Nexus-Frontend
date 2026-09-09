export const CHAT_IMAGE_COLLAPSED_HEIGHT_CLASS = 'max-h-64';
export const CHAT_IMAGE_EXPANDED_HEIGHT_CLASS = 'max-h-[80vh]';

const SHARED_IMAGE_CLASS =
  'max-w-full object-contain rounded border border-neutral-300';

/**
 * How a chat attachment is sized: capped in the bubble until the person
 * clicks it, then as tall as the viewport allows and as wide as the bubble.
 *
 * @param {boolean} expanded
 * @returns {string}
 */
export function chatImageClassName(expanded) {
  const heightClass = expanded
    ? CHAT_IMAGE_EXPANDED_HEIGHT_CLASS
    : CHAT_IMAGE_COLLAPSED_HEIGHT_CLASS;
  return expanded
    ? `${SHARED_IMAGE_CLASS} w-full ${heightClass}`
    : `${SHARED_IMAGE_CLASS} ${heightClass}`;
}

/**
 * Accessible name for the enlarge/shrink control.
 *
 * @param {boolean} expanded
 * @param {string} [filename]
 * @returns {string}
 */
export function chatImageToggleLabel(expanded, filename) {
  const name = String(filename ?? '').trim() || 'Image';
  return expanded ? `Shrink ${name}` : `Enlarge ${name}`;
}
