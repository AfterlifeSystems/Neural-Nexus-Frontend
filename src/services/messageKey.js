// src/services/messageKey.js
//
// The transcript row key the UI uses for edit / retry / regenerate. Some
// stored turns have no `id` (the live send never learns the server's id).
// The bubble then keys on `temp-<timestamp>`. Lookups that only compare
// `message.id` miss those rows and Accept becomes a no-op.

/**
 * The stable key for one transcript row.
 *
 * @param {Object} [message] A human or avatar turn.
 * @returns {string|null} The key, or null when nothing identifies the row.
 */
export function messageKeyOf(message) {
  if (message?.id != null && message.id !== '') {
    return String(message.id);
  }
  if (message?.timestamp) {
    return `temp-${message.timestamp}`;
  }
  return null;
}

/**
 * Find a transcript row by the key the bubble is using.
 *
 * @param {Array} messages The open transcript.
 * @param {string|number} key `message.id` or a `temp-<timestamp>` fallback.
 * @returns {Object|undefined} The matching turn.
 */
export function findMessageByKey(messages, key) {
  const index = findMessageIndexByKey(messages, key);
  return index < 0 ? undefined : messages[index];
}

/**
 * Index of the transcript row the bubble key refers to.
 *
 * @param {Array} messages The open transcript.
 * @param {string|number} key `message.id` or a `temp-<timestamp>` fallback.
 * @returns {number} The index, or -1.
 */
export function findMessageIndexByKey(messages, key) {
  if (key == null || key === '') return -1;
  const wanted = String(key);
  return (messages ?? []).findIndex((message) => {
    if (message?.id != null && String(message.id) === wanted) return true;
    return messageKeyOf(message) === wanted;
  });
}
