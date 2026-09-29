// src/config/langsmithThread.js
//
// The pure half of the administrator-in-dev LangSmith link: how a reply's
// recorded trace location becomes a Threads-view URL on smith.langchain.com.
// Kept free of import.meta.env so the Node test runner can load it.

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
 * The LangSmith workspace, project, and run a reply was traced to, as the API
 * records the location on `response_metadata.langsmith`.
 *
 * The API that answered the turn is the only party that knows which project
 * received the trace (`anubis` in production, `anubis-local-testing` in
 * development), so the link never guesses from the client's own build. A reply
 * without the record (tracing off, or a reply made before the record existed)
 * returns null and gets no link rather than a link to the wrong project.
 *
 * @param {Object|null|undefined} message A transcript message.
 * @returns {{workspaceId: string, projectId: string, projectName: string,
 *   runId: string|null}|null}
 */
export function langsmithLocationOf(message) {
  const langsmithRecord = message?.response_metadata?.langsmith;
  if (!langsmithRecord || typeof langsmithRecord !== 'object') return null;
  const workspaceId = String(langsmithRecord.workspace_id ?? '').trim();
  const projectId = String(langsmithRecord.project_id ?? '').trim();
  if (!workspaceId || !projectId) return null;
  return {
    workspaceId,
    projectId,
    projectName: String(langsmithRecord.project_name ?? '').trim(),
    runId: langsmithRecord.run_id ?? message?.run_id ?? null,
  };
}

/**
 * The human turn a reply without a trace record answers, as the development
 * API marks the reply on `response_metadata.langsmith_lookup`.
 *
 * Production and development share one database, so a development client
 * opens production replies written before replies recorded their LangSmith
 * location. The API resolves such a reply's run on request
 * (`GET /conversations/{thread_id}/langsmith_trace`) from the human turn the
 * reply answers.
 *
 * @param {Object|null|undefined} message A transcript message.
 * @returns {{humanMessageId: string, humanCreatedAt: string|null}|null}
 */
export function langsmithLookupOf(message) {
  const langsmithLookup = message?.response_metadata?.langsmith_lookup;
  if (!langsmithLookup || typeof langsmithLookup !== 'object') return null;
  const humanMessageId = String(langsmithLookup.human_message_id ?? '').trim();
  if (!humanMessageId) return null;
  return {
    humanMessageId,
    humanCreatedAt: langsmithLookup.human_created_at ?? null,
  };
}

/**
 * Build the LangSmith Threads URL that opens this conversation.
 *
 * `peekedConversationId` is the filter LangSmith's Threads view uses for a
 * graph thread. Time-window query params are omitted on purpose: a 1-day
 * window would hide the thread when debugging an older conversation.
 *
 * @param {Object} parameters
 * @param {string} parameters.workspaceId LangSmith workspace (tenant) id, the
 *   `/o/<workspace id>/` URL segment.
 * @param {string} parameters.projectId LangSmith project id.
 * @param {string} parameters.threadId The conversation's LangGraph thread id.
 * @param {string} [parameters.runId] Optional run to land on inside the thread.
 * @returns {string|null} An absolute LangSmith URL, or null when the thread
 *   cannot be opened.
 */
export function buildLangsmithThreadUrl({
  workspaceId,
  projectId,
  threadId,
  runId = null,
} = {}) {
  const workspace = String(workspaceId ?? '').trim();
  const project = String(projectId ?? '').trim();
  if (!workspace || !project || !isRealConversationThread(threadId)) {
    return null;
  }

  const url = new URL(
    `/o/${workspace}/projects/p/${project}`,
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
