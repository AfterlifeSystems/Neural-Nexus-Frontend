// src/config/langsmithThread.js
//
// The pure half of the administrator-in-dev LangSmith link: how a conversation
// thread becomes a Threads-view URL on smith.langchain.com. Kept free of
// import.meta.env so the Node test runner can load it.

/**
 * Neural Nexus tracing project on LangSmith. A deployment can override these
 * with VITE_LANGSMITH_ORG_ID / VITE_LANGSMITH_PROJECT_ID.
 */
export const DEFAULT_LANGSMITH_ORG_ID =
  'c5b8ed8e-026e-426c-a607-e551fba484c5';
export const DEFAULT_LANGSMITH_PROJECT_ID =
  'fb47090b-3e3b-4044-8b4f-f7242cfc386a';

export const LANGSMITH_ORIGIN = 'https://smith.langchain.com';

/**
 * The conversation the user has started but not yet sent anything to. Must
 * never be sent to LangSmith — it is a client-only placeholder, not a thread.
 * Kept here rather than imported from MediaContext so this module stays a
 * leaf.
 */
const PLACEHOLDER_THREAD_ID = '__new__';

/**
 * Whether this id names a real server-side conversation thread.
 *
 * @param {string|null|undefined} threadId
 * @returns {boolean}
 */
export function isRealConversationThread(threadId) {
  return Boolean(threadId) && threadId !== PLACEHOLDER_THREAD_ID;
}

/**
 * The first eight characters of a thread id, for a compact label.
 *
 * @param {string|null|undefined} threadId
 * @returns {string}
 */
export function shortenThreadId(threadId) {
  if (!threadId) return '';
  return threadId.length > 8 ? `${threadId.slice(0, 8)}…` : threadId;
}

/**
 * Build the LangSmith Threads URL that opens this conversation.
 *
 * `peekedConversationId` is the filter LangSmith's Threads view uses for a
 * graph thread. Time-window query params are omitted on purpose: a 1-day
 * window would hide the thread when debugging an older conversation.
 *
 * @param {Object} parameters
 * @param {string} [parameters.orgId]
 * @param {string} [parameters.projectId]
 * @param {string} parameters.threadId The conversation's LangGraph thread id.
 * @param {string} [parameters.runId] Optional run to land on inside the thread.
 * @returns {string|null} An absolute LangSmith URL, or null when the thread
 *   cannot be opened.
 */
export function buildLangsmithThreadUrl({
  orgId = DEFAULT_LANGSMITH_ORG_ID,
  projectId = DEFAULT_LANGSMITH_PROJECT_ID,
  threadId,
  runId = null,
} = {}) {
  const organization = String(orgId ?? '').trim();
  const project = String(projectId ?? '').trim();
  if (!organization || !project || !isRealConversationThread(threadId)) {
    return null;
  }

  const url = new URL(
    `/o/${organization}/projects/p/${project}`,
    LANGSMITH_ORIGIN
  );
  url.searchParams.set('runview', 'threads');
  url.searchParams.set('searchModel', '{}');
  url.searchParams.set('peekedConversationId', threadId);
  url.searchParams.set('conversationTab', 'trace');
  if (runId) {
    url.searchParams.set('run_id', String(runId));
  }
  return url.toString();
}

/**
 * Whether the LangSmith debug link should be offered at all.
 *
 * The link is a developer tool: only the administrator, only while Vite is in
 * development, and only once a real thread exists.
 *
 * @param {Object} parameters
 * @param {boolean} parameters.isDev
 * @param {boolean} parameters.isAdmin
 * @param {string|null|undefined} parameters.threadId
 * @returns {boolean}
 */
export function shouldOfferLangsmithThreadLink({
  isDev = false,
  isAdmin = false,
  threadId,
} = {}) {
  return Boolean(isDev && isAdmin && isRealConversationThread(threadId));
}
