// Pin flags for conversation threads.
//
// The LangGraph PATCH merges metadata only at the top level. Writing `pinned`
// inside `thread_metadata` replaces that nested object and drops `user_id` /
// `assistant_id`, so GET /conversations can no longer find the thread. The
// flag lives at `metadata.pinned` instead. A local overlay keeps the sidebar
// truthful if the PATCH is refused or a later message update omits the key.

const PINNED_CONVERSATIONS_STORAGE_KEY = 'neural_nexus_pinned_conversations';

/**
 * @returns {Record<string, boolean>} Thread id → pinned.
 */
export function readPinnedConversationState() {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(PINNED_CONVERSATIONS_STORAGE_KEY) || '{}'
    );
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

/**
 * Remember a pin or unpin for this browser, so a reload still shows it even
 * when the API did not echo the flag.
 *
 * @param {string} threadId The conversation.
 * @param {boolean} pinned Whether it should stay in the pinned section.
 */
export function setConversationPinnedLocally(threadId, pinned) {
  if (!threadId) return;
  const nextState = {
    ...readPinnedConversationState(),
    [threadId]: Boolean(pinned),
  };
  localStorage.setItem(
    PINNED_CONVERSATIONS_STORAGE_KEY,
    JSON.stringify(nextState)
  );
}

/**
 * The timestamp that decides list order.
 *
 * `created_at` is used rather than `updated_at` so a pin or unpin — which
 * PATCHes the thread and refreshes `updated_at` — cannot jump the row.
 *
 * @param {Object} conversation A thread record.
 * @returns {number} Milliseconds, or 0 when unknown.
 */
export function conversationChronologicalTime(conversation) {
  const stamp = conversation?.created_at ?? conversation?.updated_at ?? 0;
  const time = new Date(stamp).valueOf();
  return Number.isFinite(time) ? time : 0;
}

/**
 * Newest-created first. Pinning must not change this order.
 *
 * @param {Array<Object>} conversations Thread records.
 * @returns {Array<Object>} A new array.
 */
export function sortConversationsChronologically(conversations) {
  return [...(conversations ?? [])].sort((left, right) => {
    const delta =
      conversationChronologicalTime(right) -
      conversationChronologicalTime(left);
    if (delta !== 0) return delta;
    return String(left?.thread_id ?? '').localeCompare(
      String(right?.thread_id ?? '')
    );
  });
}

/**
 * Apply remembered pins on top of GET /conversations rows.
 *
 * @param {Array<Object>} threads Thread records from the API.
 * @returns {Array<Object>} The same rows with `metadata.pinned` resolved,
 *   in chronological order.
 */
export function overlayLocalPinState(threads) {
  const overrides = readPinnedConversationState();
  return sortConversationsChronologically(
    (threads ?? []).map((thread) => {
      const threadId = thread?.thread_id;
      const apiPinned = Boolean(
        thread?.metadata?.pinned ?? thread?.metadata?.thread_metadata?.pinned
      );
      const pinned =
        threadId && Object.prototype.hasOwnProperty.call(overrides, threadId)
          ? Boolean(overrides[threadId])
          : apiPinned;
      return {
        ...thread,
        metadata: { ...(thread.metadata ?? {}), pinned },
      };
    })
  );
}

/**
 * @param {Object} conversation A thread record.
 * @returns {boolean}
 */
export function isConversationPinned(conversation) {
  return Boolean(conversation?.metadata?.pinned);
}
