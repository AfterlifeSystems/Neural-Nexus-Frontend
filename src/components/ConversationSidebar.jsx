// src/components/ConversationSidebar.jsx
//
// The application's one sidebar. It carries two things: the account — who is
// signed in, their settings, billing, signing out — which belongs on every
// page, and the conversations held with the open avatar, which only exist
// while a chat is open. Keeping both here means there is a single place a user
// learns to reach for, rather than a panel that appears on one screen and
// account links buried on another.

import React from 'react';
import { MessageSquarePlus, X, PanelLeftOpen, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import { NEW_CONVERSATION_ID } from '../context/MediaContext';
import { useAuth } from '../context/AuthContext';
import { isValidImageUrl } from './utils';
import AccountMenu, {
  usePersonalAvatarSettingsNavigation,
} from './AccountMenu';
import qrCode from '../assets/qr-neuralnexus.png';

/**
 * Name a conversation the way the user would recognize it.
 *
 * The server stores a title once a conversation has been sent to at least
 * twice, so most of the time there is one. When there is not, the creation date
 * is more use than an identifier. The `title !== thread_id` guard is not
 * paranoia: the backend sometimes stores the thread's own id as its title, and
 * showing that is the same as showing nothing.
 *
 * @param {Object} conversation A thread record from GET /conversations.
 * @returns {string} A human-readable label.
 */
export function describeConversation(conversation) {
  if (conversation?.thread_id === NEW_CONVERSATION_ID) {
    return 'New conversation';
  }

  const storedTitle =
    conversation?.metadata?.thread_metadata?.conversation_title;
  if (storedTitle && storedTitle !== conversation?.thread_id) {
    return storedTitle;
  }

  const createdAt = conversation?.created_at;
  if (createdAt) {
    const createdDate = new Date(createdAt);
    if (!Number.isNaN(createdDate.valueOf())) {
      return `Conversation ${createdDate.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })}, ${createdDate.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    }
  }

  const threadId = conversation?.thread_id ?? '';
  return threadId ? `Conversation ${threadId.slice(0, 8)}…` : 'Conversation';
}

const ConversationSidebar = ({
  isOpen,
  onOpen,
  onClose,
  conversations,
  activeConversationId,
  onSelectConversation,
  onStartNewConversation,
  avatarName,
  showConversations = true,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, userPortrait } = useAuth();

  const openWelcomePage = () => {
    onClose?.();
    navigate('/welcome');
  };
  // The signed-in person's portrait and email lead to the settings of the
  // avatar that depicts them — the same place the account menu's entry goes.
  const openPersonalAvatarSettings =
    usePersonalAvatarSettingsNavigation(onClose);

  // The unsent conversation is not in the server's list, so it is prepended
  // here — otherwise starting one would empty the panel's selection.
  const listedConversations =
    activeConversationId === NEW_CONVERSATION_ID
      ? [{ thread_id: NEW_CONVERSATION_ID }, ...(conversations ?? [])]
      : (conversations ?? []);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Collapsed, the sidebar is a slim rail rather than a lone button: the
          panel is always present down the edge of the window, showing what it
          contains as icons, and widens into the full panel when opened. A rail
          is a place; a floating button is a thing to hunt for. */}
      {/* Collapsed, the sidebar is a slim rail down the edge of the window
          rather than a floating button — a place rather than something to hunt
          for. It carries one control: the one that opens it. */}
      {!isOpen && (
        <div className="fixed top-0 left-0 h-full w-14 z-40 bg-black/60 backdrop-blur-lg border-r border-white/10 flex flex-col items-center py-4">
          <button
            onClick={onOpen}
            className="p-2 rounded-lg text-white/70 hover:text-neutral-100 hover:bg-white/10 transition-colors"
            aria-label="Show conversations"
            title="Open the sidebar"
          >
            <PanelLeftOpen className="w-5 h-5" />
          </button>

          {/* The code stays reachable while the sidebar is collapsed: `mt-auto`
              seats it at the foot of the rail, which is the one part of the
              edge nothing else occupies. It used to float over the page here,
              where on a narrow window it covered the composer's send button. */}
          <button
            onClick={openWelcomePage}
            className="mt-auto shrink-0 p-1 rounded-lg opacity-70 hover:opacity-100 hover:bg-white/10 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:opacity-100"
            aria-label="Neural Nexus — scan or open the welcome page"
            title="Scan to share Neural Nexus, or press to open the welcome page"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-white p-1">
              <img
                src={qrCode}
                alt="QR code linking to Neural Nexus"
                width={36}
                height={36}
                className="block h-9 w-9 max-w-none shrink-0"
              />
            </span>
          </button>
        </div>
      )}

      <div
        className={`
          fixed top-0 left-0
          w-80 sm:w-96 lg:w-80
          h-full
          z-50
          bg-black/60 backdrop-blur-lg
          border-r border-white/10 lg:rounded-2xl lg:border
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          shadow-lg
        `}
      >
        <div className="flex flex-col h-full p-4 gap-4">
          {/* Who is signed in. The portrait is the personal avatar's, the same
              face that appears beside this person's messages. */}
          <div className="flex justify-between items-center gap-2">
            <button
              type="button"
              onClick={openPersonalAvatarSettings}
              title="Open your avatar's settings"
              aria-label="Open your avatar's settings"
              className="flex items-center gap-2 min-w-0 -ml-1 pl-1 pr-2 py-1 rounded-lg text-left hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-white/20"
            >
              <div className="w-9 h-9 shrink-0 rounded-full bg-black/50 border border-white/10 overflow-hidden flex items-center justify-center">
                {userPortrait && isValidImageUrl(userPortrait) ? (
                  <img
                    src={userPortrait}
                    alt="You"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-4 h-4 text-white/40" />
                )}
              </div>
              <span className="text-neutral-200 font-semibold truncate">
                {user?.email ?? 'Signed in'}
              </span>
            </button>
            <button
              onClick={onClose}
              className="text-neutral-300 hover:text-neutral-100 p-2 rounded-lg hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-white/20 shrink-0"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-1 border-b border-white/10 pb-4">
            <AccountMenu
              leadingAction="avatars"
              onNavigate={onClose}
              currentPath={location.pathname}
            />
          </div>

          {showConversations && (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wide">
                  {avatarName ? `Chats with ${avatarName}` : 'Conversations'}
                </h2>
              </div>

              <button
                onClick={onStartNewConversation}
                className="px-4 py-2 rounded-lg border border-white/10 bg-black/60 hover:bg-neutral-900 text-neutral-200 font-semibold flex items-center justify-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              >
                <MessageSquarePlus className="w-5 h-5" />
                New conversation
              </button>

              <div className="flex-grow overflow-y-auto -mx-1 px-1">
            {listedConversations.length === 0 ? (
              <p className="text-white/50 text-sm px-2 py-4">
                No conversations yet. Send a message to start one.
              </p>
            ) : (
              <ul className="space-y-1">
                {listedConversations.map((conversation) => {
                  const threadId = conversation.thread_id;
                  const isActive = threadId === activeConversationId;
                  return (
                    <li key={threadId}>
                      <button
                        onClick={() => onSelectConversation(threadId)}
                        aria-current={isActive ? 'true' : undefined}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors truncate ${
                          isActive
                            ? 'bg-neutral-700/40 text-neutral-200 border border-neutral-400/40'
                            : 'text-white/70 hover:bg-white/10 hover:text-neutral-100 border border-transparent'
                        }`}
                        title={describeConversation(conversation)}
                      >
                        {describeConversation(conversation)}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
              </div>
            </>
          )}

          {/* Opened, the code is shown at a size worth pointing a phone at.
              `mt-auto` holds it at the foot of the panel on the screens that
              list no conversations — account settings, billing, the gallery —
              where nothing above it grows to fill the space. */}
          <div className="mt-auto shrink-0 pt-4 border-t border-white/10 flex flex-col items-center gap-2">
            <button
              onClick={openWelcomePage}
              className="rounded-xl p-2 bg-black/60 border border-white/10 hover:border-neutral-300/40 hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              aria-label="Neural Nexus — scan or open the welcome page"
              title="Scan to share Neural Nexus, or press to open the welcome page"
            >
              <span className="flex h-32 w-32 shrink-0 items-center justify-center rounded-lg bg-white p-2">
                <img
                  src={qrCode}
                  alt="QR code linking to Neural Nexus"
                  width={112}
                  height={112}
                  className="block h-28 w-28 max-w-none shrink-0"
                />
              </span>
            </button>
            <span className="text-xs text-white/40">
              Scan to share Neural Nexus
            </span>
          </div>
        </div>
      </div>
    </>
  );
};

export default ConversationSidebar;
