let slots = { rail: null, panel: null };
const listeners = new Set();

/**
 * The sidebar nodes that mobile share tiles portal into.
 *
 * @returns {{ rail: Element | null, panel: Element | null }}
 */
export function getSharePreviewSlots() {
  return slots;
}

/**
 * @param {(next: { rail: Element | null, panel: Element | null }) => void} listener
 * @returns {() => void}
 */
export function subscribeSharePreviewSlots(listener) {
  listeners.add(listener);
  listener(slots);
  return () => listeners.delete(listener);
}

/**
 * Publish a sidebar mount point for the live webcam or screen tile.
 *
 * @param {'rail' | 'panel'} name
 * @param {Element | null} node
 * @returns {() => void}
 */
export function registerSharePreviewSlot(name, node) {
  slots = { ...slots, [name]: node };
  listeners.forEach((listener) => listener(slots));
  return () => {
    if (slots[name] !== node) return;
    slots = { ...slots, [name]: null };
    listeners.forEach((listener) => listener(slots));
  };
}
