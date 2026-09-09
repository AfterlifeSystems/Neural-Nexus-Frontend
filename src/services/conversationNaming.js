// src/services/conversationNaming.js
//
// The sidebar's side of automatic conversation naming.
//
// The messaging service names a conversation twice: once on the turn that
// starts it, and again when the reader leaves it. Neither name arrives with a
// listing of conversations — the first one arrives on the message stream as a
// `conversation_title` frame, and the second one is the answer to the request
// that asked for it. Both therefore have to be held here and laid back over
// every listing that follows, exactly as a pin is, or the next
// GET /conversations would hand back the row without its name and the sidebar
// would fall back to the conversation's creation date again.

/** A name written by the messaging service, and free to be rewritten. */
export const AUTOMATIC_TITLE_SOURCE = 'automatic';

/** A name the reader typed, which the messaging service never replaces. */
export const MANUAL_TITLE_SOURCE = 'user';

/**
 * Copy a thread record with a new conversation name on it.
 *
 * @param {Object} conversation A thread record from GET /conversations.
 * @param {string} title The name to show.
 * @param {string} [source] Who wrote the name.
 * @returns {Object} A new record; the original is left alone.
 */
export function withConversationName(
  conversation,
  title,
  source = AUTOMATIC_TITLE_SOURCE
) {
  const metadata = conversation?.metadata ?? {};
  return {
    ...conversation,
    metadata: {
      ...metadata,
      thread_metadata: {
        ...(metadata.thread_metadata ?? {}),
        conversation_title: title,
        conversation_title_source: source,
      },
    },
  };
}

/**
 * Lay the names learned during this session back over a fresh listing.
 *
 * A name is only laid over a row that has no name of its own, so a rename the
 * reader typed — which the server already knows about — always wins over a
 * remembered automatic name.
 *
 * @param {Array} threads Thread records from GET /conversations.
 * @param {Map<string, string>} namesByThreadId Names learned this session.
 * @returns {Array} The listing, named.
 */
export function overlayConversationNames(threads, namesByThreadId) {
  if (!namesByThreadId || namesByThreadId.size === 0) {
    return Array.isArray(threads) ? threads : [];
  }
  return (Array.isArray(threads) ? threads : []).map((conversation) => {
    const rememberedName = namesByThreadId.get(conversation?.thread_id);
    if (!rememberedName) return conversation;
    const storedName =
      conversation?.metadata?.thread_metadata?.conversation_title;
    if (storedName && storedName !== conversation?.thread_id) {
      return conversation;
    }
    return withConversationName(conversation, rememberedName);
  });
}

/**
 * The metadata patch that records a name the reader typed.
 *
 * The source is what stops the messaging service from renaming the
 * conversation over the reader's own words the next time the reader leaves it.
 *
 * @param {string} title The name the reader typed.
 * @returns {Object} A patch for PATCH /threads/{thread_id}.
 */
export function manualRenameMetadata(title) {
  return {
    thread_metadata: {
      conversation_title: title,
      conversation_title_source: MANUAL_TITLE_SOURCE,
    },
  };
}
