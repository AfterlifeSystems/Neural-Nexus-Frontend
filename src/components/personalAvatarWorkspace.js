/**
 * Paths and tab names for the signed-in person's personal avatar workspace.
 *
 * The sidebar portrait opens chat (`/chat/:id`). Settings and inbox are the
 * same workspace with a tab query, so ChatArea can stay mounted when the
 * person moves between them.
 */

import { VOICE_MODE_QUERY } from '../services/voiceModePreference.js';

const NEW_CONVERSATION_THREAD_QUERY = 'new';
// Same sentinel MediaContext exports as NEW_CONVERSATION_ID. Kept here so
// this path helper does not import the React provider.
const UNMINTED_CONVERSATION_ID = '__new__';

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
 * Chat-tab URL for a conversation.
 *
 * Voice mode and the typed message area are two ways into the same Chat tab.
 * This path never carries settings or inbox, so New conversation (and picking
 * a thread from another screen) lands on whichever of those two the browser
 * last used, not on the tab the person is leaving.
 *
 * @param {string|null|undefined} assistantId
 * @param {Object} [options]
 * @param {string|null|undefined} [options.threadId] Thread to open, or
 *   `'new'` / `'__new__'` for an unsent conversation.
 * @param {boolean} [options.voicePreferred] Last used surface was voice mode.
 * @returns {string|null}
 */
export function conversationChatPath(
  assistantId,
  { threadId, voicePreferred = false } = {}
) {
  if (!assistantId) return null;
  const params = new URLSearchParams();
  if (
    threadId === NEW_CONVERSATION_THREAD_QUERY ||
    threadId === UNMINTED_CONVERSATION_ID
  ) {
    params.set('thread', NEW_CONVERSATION_THREAD_QUERY);
  } else if (threadId) {
    params.set('thread', threadId);
  }
  if (voicePreferred) {
    params.set(VOICE_MODE_QUERY, '1');
  }
  const query = params.toString();
  return `/chat/${encodeURIComponent(assistantId)}${query ? `?${query}` : ''}`;
}

/**
 * Tab the workspace header portrait opens.
 *
 * Chat and Avatar Selection swap: the portrait is the way back and forth.
 * Inbox and Avatar Settings still open Chat, which is the conversation that
 * belongs to this face.
 *
 * @param {'chat'|'inbox'|'avatar-settings'|'avatar-selection'} [activeTab]
 * @returns {'chat'|'avatar-selection'}
 */
export function workspaceHeaderPortraitTab(activeTab) {
  if (activeTab === 'chat') return 'avatar-selection';
  return 'chat';
}

/**
 * Spoken name of the portrait control, matching the tab it will open.
 *
 * @param {'chat'|'inbox'|'avatar-settings'|'avatar-selection'} [activeTab]
 * @param {string} [avatarName]
 * @returns {string}
 */
export function workspaceHeaderPortraitLabel(activeTab, avatarName) {
  if (workspaceHeaderPortraitTab(activeTab) === 'avatar-selection') {
    return 'Open avatar selection';
  }
  return avatarName ? `Open chat with ${avatarName}` : 'Open chat';
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

/**
 * Workspace tab to paint for this location.
 *
 * Avatar Selection is not a ChatArea tab. The workspace stays mounted under
 * that screen, so `/avatars` must not be read as Chat — that empty search
 * would switch a hidden Settings screen and flash Settings on the way to
 * Chat. While the gallery is open, paint the tab the person left. Once the
 * URL is a chat workspace again, paint that URL's tab on the same render.
 *
 * @param {Object} parameters
 * @param {string|null|undefined} parameters.pathname
 * @param {URLSearchParams|string|null|undefined} parameters.search
 * @param {'chat'|'avatar-settings'|'inbox'|null|undefined} parameters.tabHeldUnderGallery
 * @param {boolean} [parameters.canOpenAvatarSettings]
 * @param {boolean} [parameters.isPersonalAvatar]
 * @param {boolean} [parameters.voiceQuery]
 * @returns {'chat'|'avatar-settings'|'inbox'}
 */
export function chatWorkspacePaintedTab({
  pathname,
  search,
  tabHeldUnderGallery,
  canOpenAvatarSettings = true,
  isPersonalAvatar = true,
  voiceQuery = false,
} = {}) {
  if (isAvatarSelectionLocation(pathname)) {
    return tabHeldUnderGallery ?? 'chat';
  }
  if (voiceQuery) return 'chat';
  const tab = chatWorkspaceTabFromSearch(search);
  if (tab === 'avatar-settings' && !canOpenAvatarSettings) return 'chat';
  if (tab === 'inbox' && !isPersonalAvatar) return 'chat';
  return tab;
}

const CHAT_WORKSPACE_PATH = /^\/chat\/([^/]+)$/;

/**
 * Avatar id named by a chat workspace URL.
 *
 * @param {string|null|undefined} pathname
 * @returns {string|null}
 */
export function chatWorkspaceAvatarId(pathname) {
  const match = CHAT_WORKSPACE_PATH.exec(pathname ?? '');
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/**
 * Whether Escape on this location should open Avatar Selection.
 *
 * Chat, inbox, and avatar settings are that workspace. The standalone inbox
 * path is the same inbox reached from the header tab. Gallery, account,
 * billing, and the map stay put.
 *
 * @param {string|null|undefined} pathname
 * @returns {boolean}
 */
export function isAvatarWorkspaceEscapeLocation(pathname) {
  if ((pathname ?? '') === '/inbox') return true;
  return CHAT_WORKSPACE_PATH.test(pathname ?? '');
}

/**
 * Whether this location is Avatar Settings.
 *
 * Settings is the chat workspace with `?tab=settings`. Chat, inbox, the
 * gallery, and every other signed-in screen are not.
 *
 * @param {string|null|undefined} pathname
 * @param {URLSearchParams|string|null|undefined} [search]
 * @returns {boolean}
 */
export function isAvatarSettingsLocation(pathname, search) {
  if (!CHAT_WORKSPACE_PATH.test(pathname ?? '')) return false;
  return chatWorkspaceTabFromSearch(search) === 'avatar-settings';
}

/**
 * Whether this location is Chat.
 *
 * Chat is the workspace with no tab query (or any query that is not settings
 * or inbox). Settings, inbox, the gallery, and every other signed-in screen
 * are not.
 *
 * @param {string|null|undefined} pathname
 * @param {URLSearchParams|string|null|undefined} [search]
 * @returns {boolean}
 */
export function isAvatarChatLocation(pathname, search) {
  if (!CHAT_WORKSPACE_PATH.test(pathname ?? '')) return false;
  return chatWorkspaceTabFromSearch(search) === 'chat';
}

/**
 * Whether this location is Avatar Selection.
 *
 * @param {string|null|undefined} pathname
 * @returns {boolean}
 */
export function isAvatarSelectionLocation(pathname) {
  return (pathname ?? '') === '/avatars';
}

/**
 * How the kept-alive gallery sits in the signed-in frame.
 *
 * When Avatar Selection is the open screen the gallery fills the frame. On
 * every other signed-in screen it stays mounted and sized, but invisible, so
 * returning does not rebuild the WebGL carousel (a rebuild is the black
 * frame between chat or settings and the gallery).
 *
 * @param {boolean} galleryIsOpen
 * @returns {string}
 */
export function avatarGalleryKeepAliveClassName(galleryIsOpen) {
  if (galleryIsOpen) return 'h-full w-full min-h-0';
  return 'invisible pointer-events-none absolute inset-0 h-full w-full overflow-hidden';
}

/**
 * Inline visibility for the live Create Avatar overlay.
 *
 * The gallery stay-alive wrapper uses Tailwind `invisible`
 * (`visibility: hidden`). A child that writes `visibility: visible`
 * shows through that wrapper, which left the plus card on the voice
 * stage. An empty string inherits, so the wrapper can hide the overlay.
 *
 * @param {boolean} galleryIsOpen
 * @param {boolean} slotIsOnScreen
 * @returns {string}
 */
export function createAvatarOverlayVisibility(galleryIsOpen, slotIsOnScreen) {
  if (galleryIsOpen && slotIsOnScreen) return '';
  return 'hidden';
}

/**
 * How the kept-alive chat workspace sits in the signed-in frame.
 *
 * Chat unmounting on Avatar Selection remounts the voice-stage portrait, which
 * first paints at the gallery disc's square and then snaps to the clip. The
 * workspace stays mounted and sized, but invisible, so that portrait does not
 * resize on the way back.
 *
 * @param {boolean} workspaceIsOpen
 * @returns {string}
 */
export function avatarWorkspaceKeepAliveClassName(workspaceIsOpen) {
  if (workspaceIsOpen) {
    return 'h-full min-h-0 overflow-y-auto overflow-x-hidden';
  }
  return 'invisible pointer-events-none absolute inset-0 h-full w-full overflow-hidden';
}
