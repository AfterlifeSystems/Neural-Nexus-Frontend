// src/services/conversationExport.js
//
// Developer download of one conversation as JSON. Offered only while Vite
// is in development; production builds never show the entry. Kept free of
// import.meta.env so the Node test runner can load it — the caller passes
// `isDev` in.

/**
 * The client-only placeholder for a conversation nothing has been sent to.
 * Duplicated from MediaContext so this module stays a leaf.
 */
const PLACEHOLDER_THREAD_ID = '__new__';

/** Bumped when the shape of the exported document changes. */
export const CONVERSATION_EXPORT_FORMAT_VERSION = 1;

/**
 * Whether the "Download JSON" action may be offered for this thread.
 *
 * A developer tool: only while Vite is in development, and only once a real
 * server-side thread exists (the unsent placeholder has nothing to fetch).
 *
 * @param {Object} parameters
 * @param {boolean} [parameters.isDev] `import.meta.env.DEV` at the call site.
 * @param {string|null|undefined} parameters.threadId The conversation's thread id.
 * @returns {boolean}
 */
export function shouldOfferConversationJsonDownload({
  isDev = false,
  threadId,
} = {}) {
  return Boolean(isDev && threadId && threadId !== PLACEHOLDER_THREAD_ID);
}

/**
 * A file name safe for every desktop: the thread id plus a timestamp.
 *
 * @param {Object} parameters
 * @param {string} parameters.threadId
 * @param {Date} [parameters.exportedAt]
 * @returns {string}
 */
export function conversationExportFilename({
  threadId,
  exportedAt = new Date(),
} = {}) {
  const safeThread = String(threadId ?? 'conversation').replace(
    /[^a-zA-Z0-9_-]+/g,
    '-'
  );
  const stamp = exportedAt
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace(/Z$/, '');
  return `conversation-${safeThread}-${stamp}.json`;
}

/**
 * Assemble the document a developer downloads.
 *
 * Both views of the transcript are kept, because they differ and each is
 * useful when debugging: `server` is the raw
 * GET /conversations/{thread_id}/messages body exactly as the API returned
 * it (LangGraph message types, tool calls, metadata); `client` is the
 * normalized list the browser painted (ids, sentiment, attachments,
 * feedback), which is what the person actually saw.
 *
 * @param {Object} parameters
 * @param {string} parameters.threadId
 * @param {string|null|undefined} [parameters.assistantId]
 * @param {Object|null|undefined} [parameters.conversation] The thread record from GET /conversations.
 * @param {Object|null|undefined} [parameters.serverResponse] Raw messages endpoint body.
 * @param {Array|null|undefined} [parameters.clientMessages] The transcript as rendered.
 * @param {Date} [parameters.exportedAt]
 * @returns {Object} A JSON-serializable document.
 */
export function buildConversationExport({
  threadId,
  assistantId = null,
  conversation = null,
  serverResponse = null,
  clientMessages = null,
  exportedAt = new Date(),
} = {}) {
  return {
    format: 'neural-nexus.conversation',
    formatVersion: CONVERSATION_EXPORT_FORMAT_VERSION,
    exportedAt: exportedAt.toISOString(),
    threadId,
    assistantId,
    conversation: conversation ?? null,
    server: serverResponse ?? null,
    client: {
      messageCount: Array.isArray(clientMessages) ? clientMessages.length : 0,
      messages: Array.isArray(clientMessages) ? clientMessages : [],
    },
  };
}

/**
 * Serialize for the file. Blobs and object URLs from restored attachments
 * cannot be written as JSON, so they are replaced with a marker.
 *
 * @param {Object} document The export document.
 * @returns {string}
 */
export function serializeConversationExport(document) {
  return JSON.stringify(
    document,
    (key, value) => {
      if (typeof Blob !== 'undefined' && value instanceof Blob) {
        return { $blob: { type: value.type, size: value.size } };
      }
      // The marker's own value is a blob: string too; leave it alone or the
      // replacer wraps it again forever.
      if (
        key !== '$objectUrl' &&
        typeof value === 'string' &&
        value.startsWith('blob:')
      ) {
        return { $objectUrl: value };
      }
      if (typeof value === 'bigint') return value.toString();
      return value;
    },
    2
  );
}

/**
 * Hand the browser a JSON file to save.
 *
 * @param {string} filename
 * @param {string} jsonText
 */
export function saveJsonFileInBrowser(filename, jsonText) {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;
  const blob = new Blob([jsonText], { type: 'application/json' });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give the click a tick to start the download before the URL is revoked.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
