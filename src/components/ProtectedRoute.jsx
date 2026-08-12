// components/ProtectedRoute.jsx
import { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMedia, NEW_CONVERSATION_ID } from '../context/MediaContext';
import LoadingSpinner from './LoadingSpinner';
import ConversationSidebar from './ConversationSidebar';
import { toast } from 'react-hot-toast';

export default function ProtectedRoute() {
  const { user, isRestoringSession, activeAvatar } = useAuth();
  const {
    conversationList,
    activeConversation,
    setActiveConversation,
    getActiveConversationMessages,
    setMessages,
  } = useMedia();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Conversations belong to an open avatar, so the sidebar shows them only on a
  // chat screen. The account half of it is shown everywhere.
  const isViewingAChat = Boolean(activeAvatar);

  /**
   * Open a different conversation with the current avatar.
   *
   * The history is re-read rather than restored from memory: another device may
   * have added to it since, and a stale transcript is indistinguishable from a
   * current one until the user notices a missing reply.
   */
  const handleSelectConversation = async (threadId) => {
    setIsSidebarOpen(false);
    setActiveConversation(threadId);
    try {
      await getActiveConversationMessages(user, activeAvatar, threadId);
    } catch (loadError) {
      console.error('Loading the conversation failed:', loadError);
      toast.error(loadError.message || 'Could not open that conversation.');
    }
  };

  /**
   * Begin a conversation that does not exist yet. Nothing is created until the
   * first message; the server mints the thread on that send.
   */
  const handleStartNewConversation = () => {
    setIsSidebarOpen(false);
    setActiveConversation(NEW_CONVERSATION_ID);
    setMessages([]);
  };

  // Until the mount-time session restore has decided whether the stored
  // credential still authenticates, render a spinner rather than bouncing a
  // signed-in user to /login on every page refresh.
  if (isRestoringSession) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <ConversationSidebar
        isOpen={isSidebarOpen}
        onOpen={() => setIsSidebarOpen(true)}
        onClose={() => setIsSidebarOpen(false)}
        conversations={conversationList}
        activeConversationId={activeConversation}
        onSelectConversation={handleSelectConversation}
        onStartNewConversation={handleStartNewConversation}
        avatarName={activeAvatar?.name}
        showConversations={isViewingAChat}
      />
      {/* The frame every signed-in screen renders into.
          `pl-14` reserves the collapsed rail's width, so left-aligned controls
          do not slide underneath it as the window narrows.
          `h-full` is load-bearing: screens size themselves against this parent,
          and a wrapper of automatic height collapses the chat panel to the
          height of its messages.
          `relative z-10` lifts the page above the animated background, which is
          painted across the whole viewport. Screens that brought their own
          positioned container were fine; the ones that did not — account
          settings, billing — rendered correctly and were then covered by it,
          which looks exactly like a page that failed to load.
          `overflow-y-auto` lets a page taller than the window scroll inside the
          frame rather than pushing the fixed rail around. */}
      <div className="pl-14 h-full relative z-10 overflow-y-auto">
        <Outlet />
      </div>
    </>
  );
}
