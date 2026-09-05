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

/**
 * Whether to ask for chips on this transcript.
 *
 * A last avatar reply always qualifies. An empty new conversation does too —
 * those chips are starters, not follow-ups. An existing thread whose messages
 * have not arrived yet must not: that empty list is a load gap, and treating
 * it as "new" flashed starters over every conversation switch.
 *
 * @param {Object} parameters
 * @param {boolean} [parameters.hasSpokenAvatarReply]
 * @param {boolean} [parameters.isNewConversation]
 * @param {boolean} [parameters.hasHumanTurn]
 * @returns {boolean}
 */
export function shouldLoadConversationSuggestions({
  hasSpokenAvatarReply = false,
  isNewConversation = false,
  hasHumanTurn = false,
} = {}) {
  return Boolean(hasSpokenAvatarReply || isNewConversation || hasHumanTurn);
}

/**
 * Starters raise themselves on an empty new chat. After the first send they
 * stay down: the open list over a waiting composer is noise, and adopting the
 * minted thread id must not raise it again.
 *
 * @param {Object} parameters
 * @param {boolean} [parameters.hasSpokenAvatarReply]
 * @param {boolean} [parameters.hasHumanTurn]
 * @returns {boolean}
 */
export function shouldAutoOpenSuggestionSheet({
  hasSpokenAvatarReply = false,
  hasHumanTurn = false,
} = {}) {
  return !hasSpokenAvatarReply && !hasHumanTurn;
}

/**
 * Fold the starter list once the first user turn is on the transcript.
 * Follow-up chips (there is already an avatar reply) keep whatever the
 * person last chose.
 *
 * @param {Object} parameters
 * @param {boolean} [parameters.hasSpokenAvatarReply]
 * @param {boolean} [parameters.hasHumanTurn]
 * @returns {boolean}
 */
export function shouldCollapseSuggestionSheetAfterSend({
  hasSpokenAvatarReply = false,
  hasHumanTurn = false,
} = {}) {
  return Boolean(hasHumanTurn) && !hasSpokenAvatarReply;
}

/** Test helper: put the shared sheet back to collapsed with no listeners. */
export function resetSuggestionSheetOpenForTests() {
  suggestionSheetOpen = false;
  suggestionSheetListeners.clear();
}
