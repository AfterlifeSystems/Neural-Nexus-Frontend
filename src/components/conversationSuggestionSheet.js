/**
 * Suggested-replies sheet: visibility and open/closed state shared by
 * message mode and voice mode.
 *
 * Those two screens mount separate copies of the sheet. The open flag lives
 * here so raising the list in one mode does not lose it in the other, and so
 * a turn in flight does not unmount the handle.
 */

// Open by default so an empty new chat shows starters at once. The list
// raises itself only at the start of a conversation and folds on the first
// send; after that only the handle (tap or swipe) or Re-roll raises it.
// A pick, Escape, or a click elsewhere never folds it.
let suggestionSheetOpen = true;
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
 * Conversation suggestions are always on. The only reason not to paint is
 * a caller that disabled them (the shared opening-question screen offers
 * its own starter). A pending send, an empty list still loading, or a
 * thread whose messages have not arrived are not reasons to hide.
 *
 * @param {Object} parameters
 * @param {boolean} [parameters.enabled]
 * @returns {boolean}
 */
export function shouldShowConversationSuggestions({ enabled = true } = {}) {
  return Boolean(enabled);
}

/**
 * Classes for the open suggestion list.
 *
 * The list stays in document flow above the handle and the composer.
 * Absolute `bottom-full` overlay sat on the message box in voice mode
 * (and on both mobile and desktop), covering the field the chips are
 * meant to fill.
 *
 * @returns {string}
 */
export function suggestionSheetMenuClassName() {
  return 'overflow-hidden rounded-xl border border-white/10 bg-black/70 backdrop-blur-lg p-1.5 mb-1';
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
 * Whether to ask the avatar for chips, not only the local pool.
 *
 * A harvest is a full avatar turn and costs an inference. Only two things
 * may pay for one: the first opening list for an avatar (custom starters
 * drawn from the identity, cached per avatar afterwards) and an explicit
 * press of the Re-roll button. A spoken reply does not harvest on its own;
 * follow-ups paint from the identity-leaned local pool until the person
 * asks for a re-roll.
 *
 * @param {Object} parameters
 * @param {boolean} [parameters.hasSpokenAvatarReply] The avatar has replied in this thread.
 * @param {boolean} [parameters.hasHumanTurn] The person has sent a message in this thread.
 * @param {boolean} [parameters.requestedByUser] The person pressed Re-roll.
 * @returns {boolean}
 */
export function shouldGenerateConversationSuggestions({
  hasSpokenAvatarReply = false,
  hasHumanTurn = false,
  requestedByUser = false,
} = {}) {
  if (requestedByUser) return true;
  return !hasSpokenAvatarReply && !hasHumanTurn;
}

/**
 * Starters raise themselves only on an empty new chat. Follow-ups never
 * raise themselves: once the person has sent a line, the list stays
 * folded until the handle or Re-roll opens it. An existing thread whose
 * messages have not arrived yet is not "new" and must not flash open.
 *
 * @param {Object} parameters
 * @param {boolean} [parameters.isNewConversation] The open thread is the unsaved new one.
 * @param {boolean} [parameters.hasHumanTurn] The person has sent a message in this thread.
 * @returns {boolean}
 */
export function shouldAutoOpenSuggestionSheet({
  isNewConversation = false,
  hasHumanTurn = false,
} = {}) {
  return Boolean(isNewConversation) && !hasHumanTurn;
}

/**
 * The first send folds the starters. The handle stays in the composer
 * row so the person can raise follow-ups whenever they want them.
 *
 * @returns {boolean}
 */
export function shouldCollapseSuggestionSheetAfterSend() {
  return true;
}

/**
 * Whether a pointer on `target` is outside every copy of the sheet.
 *
 * Voice mode and message mode each mount one. A click on the visible copy
 * must not count as outside just because the hidden copy's root does not
 * contain it.
 *
 * @param {EventTarget|null} target The event target.
 * @returns {boolean}
 */
export function shouldCloseSuggestionSheetOnOutsideClick(target) {
  if (!target || typeof target.closest !== 'function') return true;
  if (target.closest('.conversation-suggestions')) return false;
  // The list lives above the field. A press in the composer or the voice
  // message bar is using that field, not dismissing the chips.
  if (target.closest('[data-voice-message-bar]')) return false;
  if (target.closest('.chat-composer')) return false;
  return true;
}

/** Test helper: put the shared sheet back to its default (open), no listeners. */
export function resetSuggestionSheetOpenForTests() {
  suggestionSheetOpen = true;
  suggestionSheetListeners.clear();
}
