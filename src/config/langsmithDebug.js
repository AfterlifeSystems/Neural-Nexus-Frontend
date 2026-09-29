// src/config/langsmithDebug.js
//
// The Vite-facing half of the administrator-in-dev LangSmith link. The URL
// itself is built in langsmithThread.js so it can be tested without
// import.meta.env.

import { isAdminAccount } from './adminAccount';
import {
  buildLangsmithThreadUrl,
  langsmithLocationOf,
  langsmithLookupOf,
  shouldOfferLangsmithThreadLink,
} from './langsmithThread';

export { shortenThreadId } from './langsmithThread';

/**
 * The LangSmith Threads URL for this reply, or null when the link must stay
 * hidden.
 *
 * Shown only while Vite is in development AND the signed-in account is the
 * administrator (VITE_ADMIN_ACCOUNT_EMAIL, default e.woods.business@icloud.com)
 * AND the conversation has a real thread id AND the reply records the
 * LangSmith workspace and project the reply was traced to. Production builds
 * never offer the link.
 *
 * @param {Object|null|undefined} user The signed-in user from AuthContext.
 * @param {string|null|undefined} threadId The open conversation's thread id.
 * @param {Object|null|undefined} message The reply the link sits under.
 * @returns {string|null}
 */
export function langsmithDebugLinkFor(user, threadId, message) {
  if (
    !shouldOfferLangsmithThreadLink({
      isDev: import.meta.env.DEV,
      isAdmin: isAdminAccount(user),
      threadId,
    })
  ) {
    return null;
  }

  const langsmithLocation = langsmithLocationOf(message);
  if (!langsmithLocation) return null;

  return buildLangsmithThreadUrl({
    workspaceId: langsmithLocation.workspaceId,
    projectId: langsmithLocation.projectId,
    threadId,
    runId: langsmithLocation.runId,
  });
}

/**
 * The human turn to resolve through the API when this reply records no
 * LangSmith location, or null when the reply links directly or the link must
 * stay hidden. Same visibility rule as `langsmithDebugLinkFor`.
 *
 * @param {Object|null|undefined} user The signed-in user from AuthContext.
 * @param {string|null|undefined} threadId The open conversation's thread id.
 * @param {Object|null|undefined} message The reply the link sits under.
 * @returns {{humanMessageId: string, humanCreatedAt: string|null}|null}
 */
export function langsmithLookupFor(user, threadId, message) {
  if (
    !shouldOfferLangsmithThreadLink({
      isDev: import.meta.env.DEV,
      isAdmin: isAdminAccount(user),
      threadId,
    })
  ) {
    return null;
  }
  if (langsmithLocationOf(message)) return null;
  return langsmithLookupOf(message);
}
