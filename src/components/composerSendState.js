/**
 * Whether the composer should send rather than open voice mode.
 *
 * A live webcam or screen share is not a draft. Those stay on while talking
 * and are watched only by the ambient loop, as hidden observations; a typed
 * message never carries a snapshot of them.
 *
 * @param {string} text What is in the message box.
 * @param {number} fileCount How many files are waiting to send.
 * @returns {boolean}
 */
export function composerHasSendableDraft(text, fileCount) {
  return Boolean(String(text ?? '').trim()) || Number(fileCount) > 0;
}

/**
 * Whether voice mode should offer Stop instead of Leave or Send.
 *
 * A visible turn still generating, a spoken turn waiting on the stream, or
 * the avatar still talking (speech or lip-sync) are all things Stop ends.
 *
 * @param {Object} [state]
 * @param {number} [state.stoppableTurnCount]
 * @param {boolean} [state.waitingForReply]
 * @param {boolean} [state.avatarSpeaking]
 * @returns {boolean}
 */
export function voiceReplyIsStoppable({
  stoppableTurnCount = 0,
  waitingForReply = false,
  avatarSpeaking = false,
} = {}) {
  return (
    Number(stoppableTurnCount) > 0 ||
    Boolean(waitingForReply) ||
    Boolean(avatarSpeaking)
  );
}
