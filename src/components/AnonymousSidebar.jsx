// src/components/AnonymousSidebar.jsx
//
// The sidebar a visitor sees on a shared avatar link. It is the same rail and
// panel as ConversationSidebar so the two screens feel like one product, but it
// offers what a visitor with no account can actually act on: the chats they
// have held with this one avatar, a way to start another, signing up, and
// billing.
//
// The conversation list shown here is narrower than the one the API returns,
// and deliberately so. GET /conversations resolves an anonymous caller by
// hashed network ADDRESS, so its answer covers every guest chat held with this
// avatar from that address: an earlier demo run, another tab, a stranger behind
// the same office or café NAT. None of those belong to the person reading this
// panel. SharedAvatarLayout therefore lists the intersection of the server's
// answer with the threads this BROWSER started (see
// `listRememberedSharedAvatarThreadIds`), so the titles and previews stay the
// server's while the selection is this reader's.
//
// Nothing here can reach the avatar owner's own chats: every request this
// screen makes withholds the browser's session credential (see
// `isSharedAvatarChatPath` in MediaContext), so even an owner previewing their
// own link is served the guest's threads, never their private ones.
//
// Still deliberately absent: the avatar gallery, account settings, and signing
// out — none of which exist for someone who is not signed in. In their place:
// signing up, billing, and an invitation to create an avatar of their own.

import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard,
  LogIn,
  MessageSquarePlus,
  Sparkles,
  User,
  UserPlus,
  X,
  PanelLeftOpen,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { NEW_CONVERSATION_ID } from '../context/MediaContext';
import { AccountMenuItem } from './AccountMenu';
import { describeConversation } from './ConversationSidebar';
import qrCode from '../assets/qr-neuralnexus.png';

/**
 * @param {Object} props
 * @param {boolean} props.isOpen Whether the panel is expanded.
 * @param {Function} props.onOpen Expand the panel.
 * @param {Function} props.onClose Collapse the panel.
 * @param {string} props.billingPath Where the Billing entry leads. It is a path
 *   under the shared link rather than /billing, because /billing is behind the
 *   sign-in guard and a visitor following it would be bounced to the login page.
 * @param {string} [props.avatarName] The avatar this link opens, named in the
 *   sign-up invitation so it reads as an offer rather than a demand.
 * @param {Array} [props.conversations] Thread records from GET /conversations
 *   for this visitor and this avatar, newest first.
 * @param {string|null} [props.activeConversationId] The thread on screen, or
 *   the NEW_CONVERSATION_ID sentinel while the next chat is still unsent.
 * @param {Function} [props.onSelectConversation] Open a listed thread.
 * @param {Function} [props.onStartNewConversation] Begin an unsent chat.
 * @param {boolean} [props.showConversations] False on the shared link's other
 *   screens — billing has no conversation to belong to.
 */
const AnonymousSidebar = ({
  isOpen,
  onOpen,
  onClose,
  billingPath,
  avatarName,
  conversations,
  activeConversationId,
  onSelectConversation,
  onStartNewConversation,
  showConversations = true,
}) => {
  const navigate = useNavigate();
  // A shared link is public, so a signed-in person can follow one too. Offering
  // that person "Sign up" is nonsense, so the panel names what they already have
  // and points back into the application instead.
  const { user } = useAuth();

  const goTo = (path) => {
    onClose?.();
    navigate(path);
  };

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

      {!isOpen && (
        <div className="fixed top-0 left-0 h-full w-14 z-40 bg-white/5 backdrop-blur-lg border-r border-white/20 flex flex-col items-center py-4">
          <button
            onClick={onOpen}
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Open the sidebar"
            title="Open the sidebar"
          >
            <PanelLeftOpen className="w-5 h-5" />
          </button>
          <button
            onClick={() => goTo('/welcome')}
            className="mt-auto shrink-0 p-1 rounded-lg opacity-70 hover:opacity-100 hover:bg-white/10 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:opacity-100"
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
          bg-white/5 backdrop-blur-lg
          border-r border-white/20 lg:rounded-2xl lg:border
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          shadow-lg
        `}
      >
        <div className="flex flex-col h-full p-4 gap-4">
          <div className="flex justify-between items-center gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-9 h-9 shrink-0 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                <User className="w-4 h-4 text-white/40" />
              </div>
              {/* The identity named here is the identity the API is being
                  asked under, which on this screen is the anonymous visitor
                  whatever session this browser holds. Naming the signed-in
                  account instead would attribute the chats below to it, and
                  they are not its chats. The account is still named — an owner
                  previewing their own link should be able to tell they have not
                  been signed out — but as the aside it is. */}
              <div className="min-w-0">
                <span className="block text-white font-semibold truncate">
                  Anonymous visitor
                </span>
                {user?.email && (
                  <span className="block text-white/40 text-xs truncate">
                    Previewing as a guest — signed in as {user.email}
                  </span>
                )}
              </div>
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
            {user ? (
              <>
                <AccountMenuItem
                  icon={<Sparkles className="w-4 h-4 shrink-0" />}
                  label="Open Neural Nexus"
                  onClick={() => goTo('/avatars')}
                />
                <AccountMenuItem
                  icon={<CreditCard className="w-4 h-4 shrink-0" />}
                  label="Billing"
                  onClick={() => goTo(billingPath)}
                />
              </>
            ) : (
              <>
                <AccountMenuItem
                  icon={<Sparkles className="w-4 h-4 shrink-0" />}
                  label="Create your own avatar"
                  onClick={() => goTo('/signup')}
                />
                <AccountMenuItem
                  icon={<UserPlus className="w-4 h-4 shrink-0" />}
                  label="Sign up"
                  onClick={() => goTo('/signup')}
                />
                <AccountMenuItem
                  icon={<CreditCard className="w-4 h-4 shrink-0" />}
                  label="Billing"
                  onClick={() => goTo(billingPath)}
                />
              </>
            )}
          </div>

          {/* The chats held with this avatar. Same shape as the signed-in
              sidebar's list, so a visitor who later signs up finds the panel
              they already know. */}
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
                            onClick={() => onSelectConversation?.(threadId)}
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

          {!user && (
            <div className="shrink-0 rounded-xl border border-teal-400/30 bg-teal-500/10 p-4">
              <p className="text-white/80 text-sm">
                You are chatting as a guest
                {avatarName ? ` with ${avatarName}` : ''}. These chats are kept
                against this network connection rather than an account, so they
                will not follow you to another device. Sign up to keep them and
                to build an avatar of your own.
              </p>
              <button
                onClick={() => goTo('/signup')}
                className="mt-3 w-full px-4 py-2 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/30 text-teal-200 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400"
              >
                Sign up free
              </button>
              {/* Where "Log out" sits for a signed-in user. A visitor who
                  already has an account needs the opposite door, and without it
                  the only route back to a session is the landing page. */}
              <button
                onClick={() => goTo('/login')}
                className="mt-2 w-full px-4 py-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <LogIn className="w-4 h-4 shrink-0" />
                Already have an account? Log in
              </button>
            </div>
          )}

          <div className="mt-auto shrink-0 pt-4 border-t border-white/10 flex flex-col items-center gap-2">
            <button
              onClick={() => goTo('/welcome')}
              className="rounded-xl p-2 bg-white/5 border border-white/10 hover:border-teal-400/40 hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400"
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

export default AnonymousSidebar;
