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
