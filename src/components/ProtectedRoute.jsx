// components/ProtectedRoute.jsx
import { useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMedia, NEW_CONVERSATION_ID } from '../context/MediaContext';
import LoadingSpinner from './LoadingSpinner';
import ConversationSidebar from './ConversationSidebar';
import SharePreviewOutlet from './SharePreviewOutlet';
import { MediaShareProvider } from '../context/MediaShareContext';
import { toast } from 'react-hot-toast';
import { isAmbientCaptureSurface } from '../services/ambientCaptureSurface';

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
  const location = useLocation();
  const navigate = useNavigate();

  // The sidebar lists conversations wherever an avatar is open in context —
  // the gallery, account settings, billing — but only the chat screen can show
  // one. Picking a conversation anywhere else has to go to that screen first,
  // carrying the choice in the URL so the chat opens on it rather than on the
  // newest thread, which is what the chat screen opens by default.
  const activeAvatarId =
    activeAvatar?.assistant_id ?? activeAvatar?.avatar_id ?? null;
  const chatPath = activeAvatarId ? `/chat/${activeAvatarId}` : null;
  const isOnChatScreen = chatPath !== null && location.pathname === chatPath;
  // Webcam and screen stay on the rail on the gallery. Snapshots only go out
  // on the message view or voice mode — not settings, inbox, or avatar pick.
  const isConversationSurface = isAmbientCaptureSurface(
    location.pathname,
    location.search
  );

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
    if (chatPath && !isOnChatScreen) {
      navigate(`${chatPath}?thread=${encodeURIComponent(threadId)}`);
      return;
    }
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
    if (chatPath && !isOnChatScreen) {
      navigate(`${chatPath}?thread=new`);
      return;
    }
    setActiveConversation(NEW_CONVERSATION_ID);
    setMessages([]);
  };

  // Until the mount-time session restore has decided whether the stored
  // credential still authenticates, render a spinner rather than bouncing a
  // signed-in user to /login on every page refresh.
  if (isRestoringSession) {
    return <LoadingSpinner fullscreen label="Loading…" />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <MediaShareProvider
      ambientAllowed
      ambientCaptureAllowed={isConversationSurface}
    >
      <SharePreviewOutlet />
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
        showShareControls
      />
      {/* The frame every signed-in screen renders into.
          `pl-[var(--app-rail-width)]` reserves the collapsed rail's width, so
          left-aligned controls do not slide underneath it as the window
          narrows. Voice mode shortens that variable so the icon rail fits.
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
      <div className="pl-[var(--app-rail-width)] h-full min-w-0 relative z-10 overflow-y-auto overflow-x-hidden">
        <Outlet />
      </div>
    </MediaShareProvider>
  );
}
