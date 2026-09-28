/**
 * Which paused turns the InterruptPanel draws.
 *
 * A thread is shared: the Minecraft companion and the web app talk on the same
 * conversation, and the companion pauses its turns with `look_now` while the
 * body takes a screenshot. The panel used to draw EVERY pause it did not
 * recognise as the fact-review card, so a `look_now` pause read back while the
 * web app had that thread open showed "I found 0 stored items that might
 * match" — a review of nothing, stuck on screen after the companion had
 * already resumed the turn.
 *
 * A panel is drawn only for the pauses the panel knows how to answer, and a
 * fact review only when there is something to review.
 */

export const FACT_REVIEW_INTERRUPT_KINDS = new Set([
  'fact_correction',
  'research_verification',
]);

export const DEDICATED_PANEL_INTERRUPT_KINDS = new Set([
  'phone_call_confirm',
  'mcp_connect_consent',
]);

/**
 * @param {Object|null|undefined} interrupt The paused turn's interrupt value.
 * @returns {boolean} Whether the InterruptPanel should draw a panel.
 */
export function interruptNeedsPanel(interrupt) {
  if (!interrupt || typeof interrupt !== 'object') return false;
  const kind = interrupt.kind;
  if (DEDICATED_PANEL_INTERRUPT_KINDS.has(kind)) return true;
  // An older correction pause carries no kind at all, only its matches.
  const isFactReview = FACT_REVIEW_INTERRUPT_KINDS.has(kind) || kind === undefined;
  if (!isFactReview) return false;
  return Array.isArray(interrupt.matches) && interrupt.matches.length > 0;
}
