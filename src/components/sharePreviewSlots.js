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

export const SIDEBAR_SHARE_SECTION_SELECTOR = '[data-sidebar-sharing]';
const SHARE_REVEAL_AFTER_SLIDE_MS = 320;

/**
 * Scroll the open panel to the webcam / screen previews.
 *
 * @param {ParentNode | null | undefined} [root]
 * @returns {boolean} Whether the sharing section was found.
 */
export function revealSidebarSharePreviews(root = globalThis.document) {
  const target = root?.querySelector?.(SIDEBAR_SHARE_SECTION_SELECTOR);
  if (!target?.scrollIntoView) return false;
  target.scrollIntoView({ behavior: 'smooth', block: 'end' });
  return true;
}

/**
 * Open the collapsed icon rail and bring the share previews into view.
 * Footage tiles and the rail webcam / screen controls use this so their
 * click is not lost to a wrapping well that used to swallow it.
 *
 * @param {Element | null | undefined} fromNode
 * @returns {boolean} Whether a rail was found and clicked.
 */
export function openCollapsedSidebar(fromNode) {
  const rail = fromNode?.closest?.('[data-sidebar-rail]');
  if (!rail) return false;
  rail.click();
  revealSidebarSharePreviews();
  if (typeof globalThis.requestAnimationFrame === 'function') {
    globalThis.requestAnimationFrame(() => {
      revealSidebarSharePreviews();
      globalThis.setTimeout(revealSidebarSharePreviews, SHARE_REVEAL_AFTER_SLIDE_MS);
    });
  }
  return true;
}
