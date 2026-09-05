// src/services/avatarPortraitEvents.js
//
// One page-wide signal: "this avatar's portrait changed".
//
// A portrait is stored by a media job, and a finished portrait job also means
// a fresh set of emotion stills and idle loops. Several screens hold their
// own copy of the portrait — the chat header, the face beside every message,
// the settings dropzone, the gallery — and each fetched that copy when it
// mounted. Nothing told them the picture on the server had changed, so a
// portrait added through the Upload section (or a job restored after the
// page reloaded mid-upload) appeared only after the avatar was reopened.
//
// The job follower raises this signal when a portrait job finishes; the
// emotion media cache drops that avatar's manifest, and every mounted screen
// re-asks the API for the portrait it shows.

const listeners = new Set();

/**
 * @param {Function} listener Called with the assistant_id whose portrait changed.
 * @returns {Function} Unsubscribe.
 */
export const subscribeAvatarPortraitChanged = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * Announce that an avatar's stored portrait (and so its emotion media) changed.
 *
 * @param {string} assistantId The avatar whose portrait was stored or replaced.
 */
export const notifyAvatarPortraitChanged = (assistantId) => {
  if (!assistantId) return;
  for (const listener of [...listeners]) {
    try {
      listener(assistantId);
    } catch (listenerError) {
      console.error('A portrait-changed listener failed:', listenerError);
    }
  }
};

/** Tests only: drop every listener. */
export const resetAvatarPortraitListenersForTests = () => {
  listeners.clear();
};
