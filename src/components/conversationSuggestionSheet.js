/**
 * Suggested-replies sheet: visibility and open/closed state shared by
 * message mode and voice mode.
 *
 * Those two screens mount separate copies of the sheet. The open flag lives
 * here so raising the list in one mode does not lose it in the other, and so
 * a turn in flight does not unmount the handle.
 */

let suggestionSheetOpen = false;
const suggestionSheetListeners = new Set();

export function getSuggestionSheetOpen() {
  return suggestionSheetOpen;
}

export function setSuggestionSheetOpen(nextOpen) {
  const resolved =
    typeof nextOpen === 'function'
      ? nextOpen(suggestionSheetOpen)
      : nextOpen;
  const open = Boolean(resolved);
  if (open === suggestionSheetOpen) return open;
  suggestionSheetOpen = open;
  suggestionSheetListeners.forEach((listener) => listener(suggestionSheetOpen));
  return open;
}

export function subscribeSuggestionSheetOpen(listener) {
  suggestionSheetListeners.add(listener);
  return () => {
    suggestionSheetListeners.delete(listener);
  };
}

/**
 * Whether the suggested-replies chrome should paint.
 *
 * A pending send is deliberately not a reason to hide: voice mode and
 * message mode both keep the handle (and the open list) on screen while the
 * avatar is answering.
 *
 * @param {Object} parameters
 * @param {boolean} [parameters.enabled]
 * @param {boolean} [parameters.isLoading]
 * @param {number} [parameters.suggestionCount]
 * @param {number} [parameters.pendingSendCount] Ignored; accepted so a caller
 *   cannot hide the sheet by threading the in-flight count in by accident.
 * @returns {boolean}
 */
export function shouldShowConversationSuggestions({
  enabled = true,
  isLoading = false,
  suggestionCount = 0,
  pendingSendCount: _pendingSendCount = 0,
} = {}) {
  if (!enabled) return false;
  return Boolean(isLoading) || Number(suggestionCount) > 0;
}

/** Test helper: put the shared sheet back to collapsed with no listeners. */
export function resetSuggestionSheetOpenForTests() {
  suggestionSheetOpen = false;
  suggestionSheetListeners.clear();
}
