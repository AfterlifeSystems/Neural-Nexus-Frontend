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
import { useLocation } from 'react-router-dom';

import { NEW_CONVERSATION_ID } from '../context/MediaContext';
import { useAuth } from '../context/AuthContext';
import { isValidImageUrl } from './utils';
import AccountMenu from './AccountMenu';

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
  const { user, userPortrait } = useAuth();

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
        <div className="fixed top-0 left-0 h-full w-14 z-40 bg-white/5 backdrop-blur-lg border-r border-white/20 flex flex-col items-center py-4">
          <button
            onClick={onOpen}
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Show conversations"
            title="Open the sidebar"
          >
            <PanelLeftOpen className="w-5 h-5" />
          </button>
        </div>
      )}

      <div
        className={`
          fixed top-0 left-0
          w-80 sm:w-96 lg:w-80
          h-full
          z-50
          bg-white/5 backdrop-blur-lg
          border-r border-white/20 lg:rounded-2xl lg:border
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          shadow-lg
        `}
      >
        <div className="flex flex-col h-full p-4 gap-4">
          {/* Who is signed in. The portrait is the personal avatar's, the same
              face that appears beside this person's messages. */}
          <div className="flex justify-between items-center gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-9 h-9 shrink-0 rounded-full bg-white/10 border border-white/20 overflow-hidden flex items-center justify-center">
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
              <span className="text-white font-semibold truncate">
                {user?.email ?? 'Signed in'}
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-white/20 shrink-0"
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
                className="px-4 py-2 rounded-lg border border-white/20 bg-black/35 hover:bg-teal-600 text-white font-semibold flex items-center justify-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400"
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
                            ? 'bg-teal-600/30 text-white border border-teal-400/40'
                            : 'text-white/70 hover:bg-white/10 hover:text-white border border-transparent'
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

        </div>
      </div>
    </>
  );
};

export default ConversationSidebar;
