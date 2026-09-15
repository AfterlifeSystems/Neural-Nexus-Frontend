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
import PhoneCallListenBar from './PhoneCallListenBar';
import {
  canShareAvatar,
  isAvatarOwnedByUser,
  isValidImageUrl,
  readCachedAvatarIcons,
  writeCachedAvatarIcon,
} from './utils';
import useInboxCount from '../hooks/useInboxCount';
import useMissingClonedVoiceNotice from '../hooks/useMissingClonedVoiceNotice';
import { forgetUnmintedVoiceNotReadyShown } from './voiceNotReadyToast';
import {
  listUserAvatars,
  getAvatarReferenceImage,
} from '../services/avatarService';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  chatWorkspacePaintedTab,
  chatWorkspaceTabFromSearch,
  isAvatarSelectionLocation,
} from './personalAvatarWorkspace';
import useEmotionMedia, { stillFor } from '../hooks/useEmotionMedia';
import useAvatarFaceSource from '../hooks/useAvatarFaceSource';
import { seedOpenedAvatarPortraitWell } from './openedAvatarPortraitWell';
import { subscribeAvatarPortraitChanged } from '../services/avatarPortraitEvents';
import { useGeoAvatars } from '../context/GeoAvatarContext';
import {
  consumeVoiceModeSearchParams,
  readVoiceModePreference,
  searchRequestsVoiceMode,
  voiceModeIsOpen,
  voiceModeStageShouldMount,
  writeVoiceModePreference,
} from '../services/voiceModePreference';
import { primeAvatarSpeechPlayback } from '../services/avatarSpeechUnlock';

function cachedPortraitOf(assistantId) {
  if (!assistantId) return null;
  const cached = readCachedAvatarIcons()[assistantId];
  return isValidImageUrl(cached) ? cached : null;
}

const ChatArea = ({
  onActivateLiveChat,
  onEndLiveChat,
  className,
  avatarId: avatarIdFromParent,
}) => {
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
    activeConversation,
    conversationList,
  } = useMedia(); // messages is now a simple array

  const { avatarId: avatarIdFromRoute } = useParams(); // from /chat/:avatarId
  const avatarId = avatarIdFromParent ?? avatarIdFromRoute;
  seedOpenedAvatarPortraitWell(avatarId);
  // The open avatar's portrait, shown beside its name. Avatar records carry no
  // imagery, so it comes from GET /avatar_reference_image like everywhere else.
  // The gallery already has this face; do not clear it while the request runs
  // or the header snaps from a placeholder to the picture.
  const cachedPortrait = cachedPortraitOf(avatarId);
  const [avatarPortrait, setAvatarPortrait] = useState(cachedPortrait);
  const portraitForAvatarIdRef = useRef(avatarId);
  if (portraitForAvatarIdRef.current !== avatarId) {
    portraitForAvatarIdRef.current = avatarId;
    setAvatarPortrait(cachedPortrait);
  }
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  // Live mode is a different way into the same conversation, so it opens over
  // this screen rather than navigating away from it. The choice is a browser
  // preference: settings and inbox are other tabs on this workspace, and
  // returning to Chat should still be talking if that is how they left it.
  // A toast (or bookmark) can land here with `?voice=1`. Read that before the
  // first paint so the stage is up immediately, not after a flash of the
  // transcript. The query is stripped once it has been honoured.
  const [prefersVoiceMode, setPrefersVoiceMode] = useState(
    () => readVoiceModePreference() || searchRequestsVoiceMode(searchParams)
  );
  const rememberVoiceModePreference = (preferred) => {
    setPrefersVoiceMode(preferred);
    writeVoiceModePreference(preferred);
  };
  // The live camera belongs only to a person who is standing at this avatar's
  // place. A `?camera=1` on the URL is leftover navigation from a nearby
  // toast; arrival is decided by the shared position watch, not the query.
  const { isStandingAt } = useGeoAvatars();

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
  const isPersonalAvatar =
    activeAvatar?.metadata?.is_personal_avatar_of_creator === true;
  const inboxCount = useInboxCount();
  // The workspace stays mounted under Avatar Selection. The tab on screen
  // must follow the chat URL on the same render — a useEffect left Settings
  // painted for a frame on Settings → Gallery → Chat, in both message modes.
  //
  // Read that URL from useLocation(), not useSearchParams(). ChatArea is not
  // the matched /chat/:id route while the gallery is open, and useSearchParams
  // can keep the last chat query (`tab=settings`) after the pathname is
  // already /chat/:id again. That leftover query is the Settings flash.
  const workspaceSearch = location.search;
  const galleryIsCovering = isAvatarSelectionLocation(location.pathname);
  const voiceQuery = searchRequestsVoiceMode(workspaceSearch);
  const tabFromWorkspaceUrl = voiceQuery
    ? 'chat'
    : chatWorkspaceTabFromSearch(workspaceSearch);
  const tabHeldUnderGalleryRef = useRef(tabFromWorkspaceUrl);
  if (!galleryIsCovering) {
    tabHeldUnderGalleryRef.current = tabFromWorkspaceUrl;
  }
  const activeTab = chatWorkspacePaintedTab({
    pathname: location.pathname,
    search: workspaceSearch,
    tabHeldUnderGallery: tabHeldUnderGalleryRef.current,
    canOpenAvatarSettings,
    isPersonalAvatar,
    voiceQuery,
  });
  const isLiveModeOpen = voiceModeIsOpen(prefersVoiceMode, activeTab);
  const [voiceStageMounted, setVoiceStageMounted] = useState(
    () => readVoiceModePreference() || searchRequestsVoiceMode(searchParams)
  );
  useEffect(() => {
    if (prefersVoiceMode) setVoiceStageMounted(true);
  }, [prefersVoiceMode]);
  const openAvatarId = activeAvatar?.assistant_id ?? activeAvatar?.avatar_id;
  const opensOverTheCamera = isStandingAt(openAvatarId);
  const routeAvatarIsResolved = !avatarId || openAvatarId === avatarId;
  // A cloned voice has not been added yet. Ask from this screen, not only
  // from voice mode or a Speak press — a new messages conversation never
  // mounted those, so the notice never appeared.
  useMissingClonedVoiceNotice({
    assistantId: activeAvatar?.assistant_id ?? avatarId,
    avatarName: activeAvatar?.name,
    conversationId: activeConversation,
    avatar: activeAvatar,
    user,
    readerOwnsAvatar: canAdministerAvatar,
    readerIsAnonymous: false,
    enabled: activeTab === 'chat' && routeAvatarIsResolved,
  });
  // A visitor who was already on the settings tab when the avatar changed must
  // not be left looking at controls that no longer belong to them. The inbox
  // tab is the same: it only exists on the personal avatar.
  //
  // Wait until the URL's avatar is the one in context. Create (and a bookmark
  // with `?tab=settings`) lands here before that resolve finishes; bouncing
  // then would flash Chat and lose the settings tab the URL asked for.
  useEffect(() => {
    if (!routeAvatarIsResolved) {
      return;
    }
    if (galleryIsCovering) {
      return;
    }
    const requestedTab = chatWorkspaceTabFromSearch(location.search);
    if (
      (requestedTab === 'avatar-settings' && !canOpenAvatarSettings) ||
      (requestedTab === 'inbox' && !isPersonalAvatar)
    ) {
      const nextParams = new URLSearchParams(location.search);
      nextParams.delete('tab');
      setSearchParams(nextParams, { replace: true });
    }
  }, [
    canOpenAvatarSettings,
    isPersonalAvatar,
    galleryIsCovering,
    location.search,
    routeAvatarIsResolved,
    setSearchParams,
  ]);

  // `?voice=1` opens talking, not settings, and is stripped once honoured.
  useEffect(() => {
    if (galleryIsCovering) {
      return;
    }
    if (searchRequestsVoiceMode(location.search)) {
      rememberVoiceModePreference(true);
      setSearchParams(consumeVoiceModeSearchParams(location.search), {
        replace: true,
      });
    }
  }, [galleryIsCovering, location.search, setSearchParams]);

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

    const nextParams = new URLSearchParams(location.search);
    if (tab === 'avatar-settings') {
      nextParams.set('tab', 'settings');
    } else if (tab === 'inbox') {
      nextParams.set('tab', 'inbox');
      nextParams.delete('section');
    } else {
      nextParams.delete('tab');
      nextParams.delete('section');
    }
    setSearchParams(nextParams, { replace: true });
  };

  useEffect(() => {
    if (!avatarId) {
      return undefined;
    }
    let cancelled = false;
    const cached = cachedPortraitOf(avatarId);
    if (cached) {
      setAvatarPortrait(cached);
    }
    const loadPortrait = async () => {
      try {
        const portrait = await getAvatarReferenceImage(avatarId);
        if (cancelled) return;
        if (isValidImageUrl(portrait)) {
          writeCachedAvatarIcon(avatarId, portrait);
          setAvatarPortrait(portrait);
        } else if (!cached) {
          setAvatarPortrait(null);
        }
      } catch (portraitError) {
        // An avatar with no portrait is normal, and the placeholder covers it.
        console.debug('No portrait for this avatar:', portraitError);
      }
    };
    loadPortrait();
    // A portrait stored while this avatar is open — by an upload in Settings,
    // or by a job restored after the page reloaded mid-upload — replaces the
    // header face as soon as the job finishes, not on the next navigation.
    const unsubscribe = subscribeAvatarPortraitChanged((changedAssistantId) => {
      if (changedAssistantId === avatarId) loadPortrait();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [avatarId]);

  // The header face follows the most recent reply's emotion, so the avatar
  // "looks" the way it last spoke. Neutral, or an avatar with no generated
  // media, shows the portrait.
  const headerAssistantId = activeAvatar?.assistant_id ?? avatarId;
  const { manifest: emotionMedia } = useEmotionMedia(headerAssistantId);
  const { showGenerated } = useAvatarFaceSource(headerAssistantId);
  const lastReplyEmotion = [...messages]
    .reverse()
    .find((message) => message.type === 'ai' && message.sentiment?.base_emotion)
    ?.sentiment?.base_emotion;
  const headerFace = showGenerated
    ? ((lastReplyEmotion && lastReplyEmotion !== 'neutral'
        ? stillFor(emotionMedia, lastReplyEmotion)
        : null) ?? avatarPortrait)
    : avatarPortrait;

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

    const workspaceAlreadyOpen =
      openAvatarId === avatarId &&
      (messages.length > 0 ||
        Boolean(activeConversation) ||
        (conversationList?.length ?? 0) > 0);
    if (!workspaceAlreadyOpen) {
      resetConversationState();
    }

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
        if (workspaceAlreadyOpen && !requestedThreadId) {
          return;
        }
        if (requestedThreadId === 'new') {
          forgetUnmintedVoiceNotReadyShown(
            activeAvatar?.assistant_id ?? avatarId
          );
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

  useEffect(() => {
    setVoiceStageMounted(prefersVoiceMode);
    // Read the preference at the avatar change only. Switch to messages
    // must keep the hidden stage so the portrait does not remount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openAvatarId]);

  return (
    <>
      {voiceModeStageShouldMount(prefersVoiceMode, voiceStageMounted) && (
        <LiveVoiceMode
          assistantId={avatarId}
          avatarName={activeAvatar?.name}
          avatarPortrait={avatarPortrait}
          onClose={() => rememberVoiceModePreference(false)}
          onNavigateTab={handleTabChange}
          cameraBackground={opensOverTheCamera}
          stageVisible={isLiveModeOpen}
        />
      )}
      <div
        className={`flex flex-row flex-grow w-full h-full min-w-0 rounded-2xl border border-white/10 bg-black/25 backdrop-blur-md overflow-hidden relative ${
          isLiveModeOpen ? 'invisible pointer-events-none' : ''
        } ${className}`}
      >
        {/* Main Chat Section */}
        <div className="flex flex-col flex-grow min-w-0 p-2 sm:p-4 relative z-10">
          {/* Tabs. Every label stays on screen; the selected tab is marked
            with the amber underline rather than sliding the row. */}
          <AvatarWorkspaceHeader
            className="mb-2"
            avatarName={activeAvatar?.name}
            headerFace={headerFace}
            assistantId={headerAssistantId}
            onPortraitError={() => setAvatarPortrait(null)}
            activeTab={activeTab}
            isPersonalAvatar={isPersonalAvatar}
            canOpenAvatarSettings={canOpenAvatarSettings}
            inboxCount={inboxCount}
            onTabChange={handleTabChange}
          />

          {!galleryIsCovering && activeTab === 'chat' && (
            <div className="flex flex-col flex-grow min-w-0 overflow-hidden">
              <PhoneCallListenBar isPersonalAvatar={isPersonalAvatar} />
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
                    onAvatarPortraitClick={
                      canOpenAvatarSettings
                        ? () => handleTabChange('avatar-settings')
                        : undefined
                    }
                  />
                </div>
              </div>

              <div className="flex-shrink-0 min-w-0 mt-2">
                <InputBar
                  avatarId={activeAvatar?.assistant_id ?? avatarId}
                  onActivateLiveChat={() => {
                    primeAvatarSpeechPlayback();
                    rememberVoiceModePreference(true);
                  }}
                />
              </div>
            </div>
          )}

          {!galleryIsCovering && activeTab === 'inbox' && isPersonalAvatar && (
            <div className="flex flex-col flex-grow p-2 sm:p-4 relative overflow-hidden">
              <InboxPanel embedded />
            </div>
          )}

          {!galleryIsCovering &&
            activeTab === 'avatar-settings' &&
            canOpenAvatarSettings &&
            routeAvatarIsResolved && (
            <div className="flex flex-col flex-grow p-2 sm:p-4 relative overflow-y-auto">
              <AvatarSettings
                avatarId={activeAvatar?.assistant_id ?? avatarId}
                // The portrait above this tab, and the one beside every message,
                // are painted from state fetched when this screen opened. A
                // portrait replaced in the settings has to arrive here too, or the
                // old face survives on screen until the page is reloaded.
                onPortraitChanged={setAvatarPortrait}
                onAvatarDeleted={() => {
                  navigate('/avatars');
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
