/**
 * Last conversation shown for each avatar in this page.
 *
 * One MediaContext serves every avatar. Switching through the gallery used
 * to empty the transcript, then fetch, which is the loading flash between
 * avatar 1's chat and avatar 2's chat. Remember what was on screen and put
 * it back before the next paint.
 */

const conversationWorkspaceByAssistant = new Map();

/**
 * @typedef {Object} ConversationWorkspace
 * @property {Array} messages
 * @property {Array} conversationList
 * @property {string|null} activeConversation
 */

/**
 * @param {string|null|undefined} assistantId
 * @param {ConversationWorkspace|null|undefined} workspace
 */
export function rememberConversationWorkspace(assistantId, workspace) {
  if (!assistantId) return;
  conversationWorkspaceByAssistant.set(assistantId, {
    messages: [...(workspace?.messages ?? [])],
    conversationList: [...(workspace?.conversationList ?? [])],
    activeConversation: workspace?.activeConversation ?? null,
  });
}

/**
 * @param {string|null|undefined} assistantId
 * @returns {ConversationWorkspace|null}
 */
export function recalledConversationWorkspace(assistantId) {
  if (!assistantId) return null;
  const workspace = conversationWorkspaceByAssistant.get(assistantId);
  if (!workspace) return null;
  return {
    messages: [...workspace.messages],
    conversationList: [...workspace.conversationList],
    activeConversation: workspace.activeConversation,
  };
}

/**
 * @param {string|null|undefined} assistantId
 */
export function forgetConversationWorkspace(assistantId) {
  if (!assistantId) return;
  conversationWorkspaceByAssistant.delete(assistantId);
}

/**
 * Test helper: drop every remembered workspace.
 */
export function forgetAllConversationWorkspaces() {
  conversationWorkspaceByAssistant.clear();
}
