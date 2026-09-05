// src/components/ChatArea.jsx

import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import MessageList from './MessageList';
import InputBar from './InputBar';
import { useAuth } from '../context/AuthContext';
import { useMedia, NEW_CONVERSATION_ID } from '../context/MediaContext';
import AvatarSettings from './AvatarSettings';
import AvatarWorkspaceHeader from './AvatarWorkspaceHeader';
import InboxPanel from './inbox/InboxPanel';
import LiveVoiceMode from './LiveVoiceMode';
import { isAvatarOwnedByUser, canShareAvatar } from './utils';
import useInboxCount from '../hooks/useInboxCount';
import {
  listUserAvatars,
  getAvatarReferenceImage,
} from '../services/avatarService';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import useEmotionMedia, { stillFor } from '../hooks/useEmotionMedia';
import {
  readVoiceModePreference,
  voiceModeIsOpen,
  writeVoiceModePreference,
} from '../services/voiceModePreference';

const ChatArea = ({ onActivateLiveChat, onEndLiveChat, className }) => {
  const { activeAvatar, setActiveAvatar, userAvatars, user, setContext } =
    useAuth();
  const {
    messages,
    messagesEndRef,
    getConversationList,
    getActiveConversationMessages,
    setActiveConversation,
    setMessages,
    resetConversationState,
  } = useMedia(); // messages is now a simple array

  // The open avatar's portrait, shown beside its name. Avatar records carry no
  // imagery, so it comes from GET /avatar_reference_image like everywhere else.
  const [avatarPortrait, setAvatarPortrait] = useState(null);
  // Live mode is a different way into the same conversation, so it opens over
  // this screen rather than navigating away from it. The choice is a browser
  // preference: settings and inbox are other tabs on this workspace, and
  // returning to Chat should still be talking if that is how they left it.
  const [prefersVoiceMode, setPrefersVoiceMode] = useState(
    readVoiceModePreference
  );
  const rememberVoiceModePreference = (preferred) => {
    setPrefersVoiceMode(preferred);
    writeVoiceModePreference(preferred);
  };
  const { avatarId } = useParams(); // from /chat/:avatarId
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // const [activeTab, setActiveTab] = useState('avatar-settings');
  const [activeTab, setActiveTab] = useState(() => {
    const requestedTab = searchParams.get('tab');
    if (requestedTab === 'settings') return 'avatar-settings';
    if (requestedTab === 'inbox') return 'inbox';
    return 'chat';
  });
  const isLiveModeOpen = voiceModeIsOpen(prefersVoiceMode, activeTab);

  // Settings administer the avatar — rename, portrait, documents, sharing,
  // deletion — and every one of those is refused by the API for an avatar the
  // caller did not create. Offering the controls anyway only produces errors,
  // so a visitor to someone else's avatar gets the chat and nothing more.
  const canAdministerAvatar = isAvatarOwnedByUser(activeAvatar, user);

  // The administrator is the exception: that account may publish or withdraw an
  // avatar it did not create, so the settings tab opens for it as well and
  // shows the sharing control alone.
  const canOpenAvatarSettings =
    canAdministerAvatar || canShareAvatar(activeAvatar, user);

  // The agent inbox belongs to the personal avatar: that is the one that
  // triages the owner's mail. Other avatars have no inbox to show.
  const isPersonalAvatar = Boolean(
    activeAvatar?.metadata?.is_personal_avatar_of_creator
  );
  const inboxCount = useInboxCount();

  // A visitor who was already on the settings tab when the avatar changed must
  // not be left looking at controls that no longer belong to them. The inbox
  // tab is the same: it only exists on the personal avatar.
  useEffect(() => {
    if (!canOpenAvatarSettings && activeTab === 'avatar-settings') {
      setActiveTab('chat');
    }
    if (!isPersonalAvatar && activeTab === 'inbox') {
      setActiveTab('chat');
    }
  }, [canOpenAvatarSettings, isPersonalAvatar, activeTab]);

  // `?tab=settings` opens this screen on the settings tab. The account menu
  // uses it to send someone straight to their own avatar's settings, which
  // otherwise takes a detour through the chat and a second click.
  // `?tab=inbox` does the same for the personal avatar's inbox.
  useEffect(() => {
    const requestedTab = searchParams.get('tab');
    if (requestedTab === 'settings' && canOpenAvatarSettings) {
      setActiveTab('avatar-settings');
    }
    if (requestedTab === 'inbox' && isPersonalAvatar) {
      setActiveTab('inbox');
    }
  }, [searchParams, canOpenAvatarSettings, isPersonalAvatar]);

  // Make the URL sufficient to open a chat.
  //
  // The avatar is normally chosen on the selection screen, which puts it in
  // context on the way here. Arriving any other way — a refresh, a bookmark, a
  // link — leaves context empty while the URL still names the avatar perfectly
  // well, and the screen would sit there loading nothing at all. Resolve the
  // route parameter against the user's avatars instead.
  useEffect(() => {
    if (!user || !avatarId) {
      return undefined;
    }
    const activeAvatarId =
      activeAvatar?.assistant_id ?? activeAvatar?.avatar_id;
    if (activeAvatarId === avatarId) {
      return undefined;
    }

    let cancelled = false;
    (async () => {
      const findInList = (avatarList) =>
        (avatarList ?? []).find(
          (candidate) =>
            (candidate.assistant_id ?? candidate.avatar_id) === avatarId
        );

      let matchingAvatar = findInList(userAvatars);
      if (!matchingAvatar) {
        try {
          matchingAvatar = findInList(await listUserAvatars());
        } catch (listError) {
          console.error('Resolving the avatar from the URL failed:', listError);
        }
      }
      if (cancelled) return;

      if (matchingAvatar) {
        setActiveAvatar(matchingAvatar);
      } else {
        // The URL names an avatar this account cannot open. Send the user
        // somewhere real rather than leaving a chat window that never loads.
        toast.error('That avatar is not available.');
        navigate('/avatars');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, avatarId, activeAvatar, userAvatars, setActiveAvatar, navigate]);

  // Simple tab switcher. Settings and Inbox are also addressable as
  // `?tab=settings` / `?tab=inbox`, so the URL has to follow the click —
  // otherwise a refresh drops you back on Chat.
  const handleTabChange = (tab) => {
    if (tab === 'avatar-selection') {
      navigate('/avatars');
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    if (tab === 'avatar-settings') {
      nextParams.set('tab', 'settings');
      setActiveTab('avatar-settings');
    } else if (tab === 'inbox') {
      nextParams.set('tab', 'inbox');
      nextParams.delete('section');
      setActiveTab('inbox');
    } else {
      nextParams.delete('tab');
      nextParams.delete('section');
      setActiveTab('chat');
    }
    setSearchParams(nextParams, { replace: true });
  };

  useEffect(() => {
    if (!avatarId) {
      return undefined;
    }
    let cancelled = false;
    setAvatarPortrait(null);
    (async () => {
      try {
        const portrait = await getAvatarReferenceImage(avatarId);
        if (!cancelled) {
          setAvatarPortrait(portrait);
        }
      } catch (portraitError) {
        // An avatar with no portrait is normal, and the placeholder covers it.
        console.debug('No portrait for this avatar:', portraitError);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [avatarId]);

  // The header face follows the most recent reply's emotion, so the avatar
  // "looks" the way it last spoke. Neutral, or an avatar with no generated
  // media, shows the portrait.
  const { manifest: emotionMedia } = useEmotionMedia(
    activeAvatar?.assistant_id ?? avatarId
  );
  const lastReplyEmotion = [...messages]
    .reverse()
    .find((message) => message.type === 'ai' && message.sentiment?.base_emotion)
    ?.sentiment?.base_emotion;
  const headerFace =
    (lastReplyEmotion && lastReplyEmotion !== 'neutral'
      ? stillFor(emotionMedia, lastReplyEmotion)
      : null) ?? avatarPortrait;

  // Load the open avatar's conversation.
  //
  // Ordering matters here. The screen is cleared BEFORE the first request goes
  // out, because this effect spans two round trips and whatever is in state
  // until they return belongs to the avatar the user just navigated away from.
  //
  // `loadGeneration` makes the last navigation win. Two quick avatar switches
  // leave two loads in flight, and without this the slower one lands last and
  // paints the wrong conversation; a stale load now finds its generation
  // superseded and drops its result.
  const loadGeneration = useRef(0);
  const openAvatarId = activeAvatar?.assistant_id ?? activeAvatar?.avatar_id;

  useEffect(() => {
    // Wait for context and the URL to agree on which avatar is open. In the
    // moment between navigating and resolving the route parameter they name
    // different avatars, and loading then would fetch the old avatar's
    // conversations into the new avatar's window — the very bug being fixed.
    if (!user || !activeAvatar || (avatarId && openAvatarId !== avatarId)) {
      return undefined;
    }

    const thisGeneration = ++loadGeneration.current;
    const isCurrentLoad = () => loadGeneration.current === thisGeneration;

    resetConversationState();

    (async () => {
      try {
        setContext({
          user_ctx: {
            user_id: user.id,
            name: user.name || '',
            description: user.description || '',
            metadata: user.metadata || {},
          },
          assistant_ctx: {
            assistant_id: avatarId,
            user_id: user.id,
            name: user.name || '',
            description: user.description || '',
            metadata: user.metadata || {},
          },
        });

        const threads = await getConversationList(user, activeAvatar);
        if (!isCurrentLoad()) return;

        // Open the thread named in the URL when the sidebar sent someone here
        // from another screen (`?thread=<id>`, or `?thread=new` for a fresh
        // conversation). Otherwise open the newest thread. A brand-new avatar
        // has none, and that must resolve to "no conversation yet" rather than
        // falling back to anything remembered from a previous avatar.
        const requestedThreadId = searchParams.get('thread');
        if (requestedThreadId === 'new') {
          setActiveConversation(NEW_CONVERSATION_ID);
          setMessages([]);
          return;
        }
        const requestedThreadExists = (threads ?? []).some(
          (thread) => thread.thread_id === requestedThreadId
        );
        const threadIdToOpen = requestedThreadExists
          ? requestedThreadId
          : (threads?.[0]?.thread_id ?? NEW_CONVERSATION_ID);
        setActiveConversation(threadIdToOpen);
        if (threadIdToOpen === NEW_CONVERSATION_ID) {
          setMessages([]);
          return;
        }

        await getActiveConversationMessages(user, activeAvatar, threadIdToOpen);
        if (!isCurrentLoad()) return;
      } catch (error) {
        if (!isCurrentLoad()) return;
        console.error('Loading the avatar conversation failed:', error);
        // Say so: the alternative is an empty chat that looks like a fresh
        // conversation, and the user then types into a void.
        toast.error(
          error.message || 'Could not load this conversation. Try reopening it.'
        );
      }
    })();

    return () => {
      // Any load still in flight belongs to the avatar being left behind.
      loadGeneration.current += 1;
    };
    // Keyed on the avatar id, not the object. Replacing the same avatar with a
    // new record used to reset the transcript mid-send — the optimistic line
    // stayed, the in-flight reply was wiped, and a retry stored a duplicate.
    // The context functions this calls are rebuilt on every render of the
    // provider, so listing them would reload the conversation on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, openAvatarId, avatarId]);

  return (
    <>
      {isLiveModeOpen && (
        <LiveVoiceMode
          assistantId={activeAvatar?.assistant_id ?? avatarId}
          avatarName={activeAvatar?.name}
          avatarPortrait={avatarPortrait}
          onClose={() => rememberVoiceModePreference(false)}
          onNavigateTab={handleTabChange}
        />
      )}
      <div
        className={`flex flex-row flex-grow w-full h-full min-w-0 bg-black/60 backdrop-blur-lg rounded-2xl border border-white/10 overflow-hidden relative ${
          isLiveModeOpen ? 'invisible pointer-events-none' : ''
        } ${className}`}
      >
        {/* Main Chat Section */}
        <div className="flex flex-col flex-grow min-w-0 p-2 sm:p-4 relative z-10">
          {/* Tabs */}
          {/* On a phone the three tabs plus the avatar's name do not fit in one
            row, so the row scrolls sideways and the labels drop their
            prefixes rather than wrapping the name over four lines. */}
          <AvatarWorkspaceHeader
            className="mb-2"
            avatarName={activeAvatar?.name}
            headerFace={headerFace}
            onPortraitError={() => setAvatarPortrait(null)}
            activeTab={activeTab}
            isPersonalAvatar={isPersonalAvatar}
            canOpenAvatarSettings={canOpenAvatarSettings}
            inboxCount={inboxCount}
            onTabChange={handleTabChange}
          />

          {activeTab === 'chat' && (
            <div className="flex flex-col flex-grow min-w-0 overflow-hidden">
              <div className="flex-grow overflow-y-auto overflow-x-hidden p-2 sm:p-4 relative min-w-0">
                {/* Same width as the composer below (InputBar is max-w-3xl
                  mx-auto). Without it the transcript ran the full width of the
                  window while the input sat centred beneath it. */}
                <div className="w-full max-w-3xl mx-auto min-w-0">
                  <MessageList
                    messages={messages} // Pass messages array directly
                    messagesEndRef={messagesEndRef}
                    avatarPortrait={avatarPortrait}
                    avatarName={activeAvatar?.name}
                    assistantId={activeAvatar?.assistant_id ?? avatarId}
                  />
                </div>
              </div>

              <div className="flex-shrink-0 min-w-0 mt-2">
                <InputBar
                  avatarId={activeAvatar?.assistant_id ?? avatarId}
                  onActivateLiveChat={() => rememberVoiceModePreference(true)}
                />
              </div>
            </div>
          )}

          {activeTab === 'inbox' && isPersonalAvatar && (
            <div className="flex flex-col flex-grow p-2 sm:p-4 relative overflow-hidden">
              <InboxPanel embedded />
            </div>
          )}

          {activeTab === 'avatar-settings' && canOpenAvatarSettings && (
            <div className="flex flex-col flex-grow p-2 sm:p-4 relative overflow-y-auto">
              <AvatarSettings
                avatarId={activeAvatar?.assistant_id ?? avatarId}
                // The portrait above this tab, and the one beside every message,
                // are painted from state fetched when this screen opened. A
                // portrait replaced in the settings has to arrive here too, or the
                // old face survives on screen until the page is reloaded.
                onPortraitChanged={setAvatarPortrait}
                onAvatarDeleted={() => {
                  // Switch to avatar selection tab after deletion
                  setActiveTab('avatar-selection');
                }}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ChatArea;
