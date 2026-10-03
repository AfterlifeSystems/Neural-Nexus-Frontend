// src/services/langsmithTraceService.js
//
// The development API's lookup of a reply's LangSmith run, for replies stored
// before replies recorded their LangSmith location (see
// src/config/langsmithThread.js).

import { requestJson } from './neuralNexusApiClient';

/**
 * Find the LangSmith workspace, project, and run of the reply to a human turn.
 * GET /conversations/{thread_id}/langsmith_trace — development API only, for
 * any signed-in account; a production API, and a turn with no run, answers 404.
 *
 * @param {Object} parameters
 * @param {string} parameters.threadId The conversation's thread id.
 * @param {string} parameters.humanMessageId The human turn the reply answers.
 * @param {string|null} [parameters.humanCreatedAt] When the human turn was
 *   written; narrows the search to the root runs that started near that time.
 * @returns {Promise<Object|null>} `{workspace_id, project_id, project_name,
 *   run_id}`, or null when the API returned no record.
 */
export const findLangsmithTrace = async ({
  threadId,
  humanMessageId,
  humanCreatedAt = null,
}) => {
  const response = await requestJson(
    `/conversations/${encodeURIComponent(threadId)}/langsmith_trace`,
    {
      query: {
        human_message_id: humanMessageId,
        human_created_at: humanCreatedAt || undefined,
      },
    }
  );
  return response?.langsmith ?? null;
};
