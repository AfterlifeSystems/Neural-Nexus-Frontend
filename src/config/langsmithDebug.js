// src/config/langsmithDebug.js
//
// The Vite-facing half of the administrator-in-dev LangSmith link. The URL
// itself is built in langsmithThread.js so it can be tested without
// import.meta.env.

import { isAdminAccount } from './adminAccount';
import {
  DEFAULT_LANGSMITH_ORG_ID,
  DEFAULT_LANGSMITH_PROJECT_ID,
  buildLangsmithThreadUrl,
  shouldOfferLangsmithThreadLink,
} from './langsmithThread';

export { shortenThreadId } from './langsmithThread';

function configuredId(rawValue, fallback) {
  const trimmed = String(rawValue ?? '').trim();
  return trimmed || fallback;
}

/**
 * The LangSmith Threads URL for this conversation, or null when the link
 * must stay hidden.
 *
 * Shown only while Vite is in development AND the signed-in account is the
 * administrator (VITE_ADMIN_ACCOUNT_EMAIL, default e.woods.business@icloud.com)
 * AND the conversation has a real thread id. Production builds never offer it.
 *
 * @param {Object|null|undefined} user The signed-in user from AuthContext.
 * @param {string|null|undefined} threadId The open conversation's thread id.
 * @param {string|null|undefined} [runId] Optional LangSmith run to land on.
 * @returns {string|null}
 */
export function langsmithDebugLinkFor(user, threadId, runId) {
  if (
    !shouldOfferLangsmithThreadLink({
      isDev: import.meta.env.DEV,
      isAdmin: isAdminAccount(user),
      threadId,
    })
  ) {
    return null;
  }

  return buildLangsmithThreadUrl({
    orgId: configuredId(
      import.meta.env.VITE_LANGSMITH_ORG_ID,
      DEFAULT_LANGSMITH_ORG_ID
    ),
    projectId: configuredId(
      import.meta.env.VITE_LANGSMITH_PROJECT_ID,
      DEFAULT_LANGSMITH_PROJECT_ID
    ),
    threadId,
    runId,
  });
}
