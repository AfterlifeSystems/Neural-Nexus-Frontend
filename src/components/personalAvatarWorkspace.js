/**
 * Paths and tab names for the signed-in person's personal avatar workspace.
 *
 * The sidebar portrait opens chat (`/chat/:id`). Settings and inbox are the
 * same workspace with a tab query, so ChatArea can stay mounted when the
 * person moves between them.
 */

/**
 * The workspace URL for a personal avatar.
 *
 * @param {string|null|undefined} assistantId
 * @param {'chat'|'settings'|'inbox'} [tab]
 * @returns {string|null}
 */
export function personalAvatarWorkspacePath(assistantId, tab = 'chat') {
  if (!assistantId) return null;
  const encoded = encodeURIComponent(assistantId);
  if (tab === 'settings') return `/chat/${encoded}?tab=settings`;
  if (tab === 'inbox') return `/chat/${encoded}?tab=inbox`;
  return `/chat/${encoded}`;
}

/**
 * Tab the workspace header portrait opens. Always Chat, from Inbox,
 * Avatar Settings, or Avatar Selection.
 *
 * @returns {'chat'}
 */
export function workspaceHeaderPortraitTab() {
  return 'chat';
}

/**
 * The URL for a workspace tab. Chat, settings and inbox stay on `/chat/:id`.
 * Avatar Selection is its own screen.
 *
 * @param {string|null|undefined} assistantId
 * @param {'chat'|'settings'|'inbox'|'avatar-settings'|'avatar-selection'} [tab]
 * @returns {string|null}
 */
export function avatarWorkspacePath(assistantId, tab = 'chat') {
  if (tab === 'avatar-selection') return '/avatars';
  if (tab === 'avatar-settings' || tab === 'settings') {
    return personalAvatarWorkspacePath(assistantId, 'settings');
  }
  if (tab === 'inbox') return personalAvatarWorkspacePath(assistantId, 'inbox');
  return personalAvatarWorkspacePath(assistantId, 'chat');
}

/**
 * Which workspace tab the URL is asking for.
 *
 * A missing `tab` is Chat. That is what the sidebar portrait navigates to,
 * and ChatArea must honour it even when the same screen stays mounted.
 *
 * @param {URLSearchParams|string|null|undefined} searchParams
 * @returns {'chat'|'avatar-settings'|'inbox'}
 */
export function chatWorkspaceTabFromSearch(searchParams) {
  const params =
    searchParams instanceof URLSearchParams
      ? searchParams
      : new URLSearchParams(typeof searchParams === 'string' ? searchParams : '');
  const requestedTab = params.get('tab');
  if (requestedTab === 'settings') return 'avatar-settings';
  if (requestedTab === 'inbox') return 'inbox';
  return 'chat';
}
