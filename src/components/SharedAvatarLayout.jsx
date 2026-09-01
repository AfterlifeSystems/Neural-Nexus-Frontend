// src/components/SharedAvatarLayout.jsx
//
// The frame every public shared-link screen renders into: the visitor's sidebar
// down the edge, and the screen itself in the space beside it.
//
// It mirrors the frame ProtectedRoute builds for signed-in screens — same rail
// width reserved, same scrolling behaviour, same lift above the animated
// background, and the same conversation switching — but without the sign-in
// guard, because these screens exist precisely for people who have not signed
// in. The conversations themselves live in MediaContext exactly as they do for
// a signed-in user; this layout is above the chat screen in the tree, which is
// why the panel can list them while the chat below paints them.

import React, { useMemo, useState } from 'react';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';

import { useAuth } from '../context/AuthContext';
import { useMedia, NEW_CONVERSATION_ID } from '../context/MediaContext';
import AnonymousSidebar from './AnonymousSidebar';
import { listRememberedSharedAvatarThreadIds } from './utils';

const SharedAvatarLayout = () => {
  const { avatarId } = useParams();
  const location = useLocation();
  // Named by the chat screen once it has resolved the avatar. Until then the
  // sidebar simply omits the name rather than showing a placeholder.
  const { activeAvatar } = useAuth();
  const {
    conversationList,
    activeConversation,
    setActiveConversation,
    getActiveConversationMessages,
    setMessages,
  } = useMedia();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Conversations belong to the chat. The billing screen under this same link
  // has none, and listing them there would offer a switch that goes nowhere.
  const sharedChatPath = `/share/${avatarId}`;
  const isViewingSharedChat =
    Boolean(activeAvatar) &&
    (location.pathname === sharedChatPath ||
      location.pathname === `${sharedChatPath}/`);

  // The chats to offer: those the server confirms belong to this anonymous
  // identity AND that this browser started. The API resolves an anonymous
  // caller by network address, so the server's half of that intersection also
  // contains guest chats belonging to whoever else shares the address — an
  // earlier demo run, another tab, a stranger behind the same NAT. Listing
  // those as the reader's own is what made a shared link look like it had
  // opened somebody's account.
  //
  // `activeConversation` is admitted whether or not it is remembered yet: a
  // thread minted moments ago by the first message is unambiguously this
  // reader's, and the note recording it is written by an effect that may not
  // have run for this render.
  const visitorConversations = useMemo(() => {
    const threadsStartedHere = new Set(
      listRememberedSharedAvatarThreadIds(avatarId)
    );
    return (conversationList ?? []).filter(
      (conversation) =>
        threadsStartedHere.has(conversation.thread_id) ||
        conversation.thread_id === activeConversation
    );
  }, [avatarId, conversationList, activeConversation]);

  /**
   * Open a different conversation with this avatar.
   *
   * The history is re-read rather than restored from memory, for the same
   * reason ProtectedRoute re-reads it: a transcript held in state is stale the
   * moment anything is added to the thread elsewhere, and a stale transcript is
   * indistinguishable from a current one until a reply turns out to be missing.
   */
  const handleSelectConversation = async (threadId) => {
    setIsSidebarOpen(false);
    setActiveConversation(threadId);
    if (threadId === NEW_CONVERSATION_ID) {
      setMessages([]);
      return;
    }
    try {
      await getActiveConversationMessages(null, activeAvatar, threadId);
    } catch (loadError) {
      console.error('Loading the conversation failed:', loadError);
      toast.error(loadError.message || 'Could not open that conversation.');
    }
  };

  /**
   * Begin a conversation that does not exist yet. Nothing is created until the
   * first message; the server mints the thread on that send, and the stream's
   * terminal frame is what puts it in the list.
   */
  const handleStartNewConversation = () => {
    setIsSidebarOpen(false);
    setActiveConversation(NEW_CONVERSATION_ID);
    setMessages([]);
  };

  return (
    <>
      <AnonymousSidebar
        isOpen={isSidebarOpen}
        onOpen={() => setIsSidebarOpen(true)}
        onClose={() => setIsSidebarOpen(false)}
        billingPath={`/share/${avatarId}/billing`}
        avatarName={activeAvatar?.name}
        conversations={visitorConversations}
        activeConversationId={activeConversation}
        onSelectConversation={handleSelectConversation}
        onStartNewConversation={handleStartNewConversation}
        showConversations={isViewingSharedChat}
      />
      <div className="pl-14 h-full w-full relative z-10 overflow-y-auto">
        <Outlet />
      </div>
    </>
  );
};

export default SharedAvatarLayout;
