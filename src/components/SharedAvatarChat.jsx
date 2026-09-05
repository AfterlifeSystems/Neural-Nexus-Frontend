// src/components/SharedAvatarChat.jsx
//
// One avatar, chatted with by anyone holding the link — no account, no sign-in.
//
// This is the public face of an avatar its creator has shared. It is
// deliberately a different screen from ChatArea rather than a mode of it: what
// makes ChatArea useful to an owner (the avatar gallery, the settings tab,
// switching avatars) is exactly what must not be here. The visitor sees one
// avatar — but every chat they have held with it, listed in the sidebar beside
// this screen, because a visitor who returns to the link has the same claim on
// what they said yesterday as a signed-in user has on theirs.
//
// Nothing about the request path is special. The API resolves an anonymous
// identity for any caller with no credential — the same behaviour the Streamlit
// interface relies on for its `?assistant_id=` links — so the ordinary message
// stream in MediaContext works unchanged, and so does GET /conversations, which
// searches threads on that anonymous identity AND the avatar in the request.
// That pairing is what makes the history here the visitor's own chats with this
// avatar and nothing else. The avatar itself is read from
// GET /list_public_avatars, which returns an avatar ONLY while it is shared:
// withdrawing the avatar therefore closes this page by itself, and no separate
// check is needed here.

import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MessageCircle, Sparkles, User } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useMedia, NEW_CONVERSATION_ID } from '../context/MediaContext';
import { listPublicAvatars, getAvatarReferenceImage } from '../services/avatarService';
import {
  isValidImageUrl,
  resolveAssistantId,
  rememberSharedAvatarThread,
  listRememberedSharedAvatarThreadIds,
  followPathInTopWindow,
} from './utils';
import LoadingSpinner from './LoadingSpinner';
import LiveVoiceMode from './LiveVoiceMode';
import MessageList from './MessageList';
import InputBar from './InputBar';

// The one-click opening question offered in an empty chat. It is the first
// thing a visitor to the landing page's embedded demo sees inside the frame
// (src/components/Landing/LiveAvatarDemo.jsx), and it asks the avatar to
// introduce itself — the answer that turns a blank chat window into a
// demonstration of what the avatar is. Every shared avatar gets the same
// offer, because the question is about whoever the link opens rather than
// about any particular one of them.
const OPENING_QUESTION = 'Hey - tell me all about yourself and what you can do for me';

const SharedAvatarChat = () => {
  const { avatarId } = useParams();
  const navigate = useNavigate();

  /**
   * Leave this screen for another part of the application.
   *
   * Written as one helper rather than a bare `navigate` because this screen is
   * also the landing page's embedded demo: a whole screen opened from inside
   * that frame has to take the whole window with it.
   */
  const openApplicationScreen = (applicationPath) => {
    if (followPathInTopWindow(applicationPath)) return;
    navigate(applicationPath);
  };
  const { activeAvatar, setActiveAvatar } = useAuth();
  const {
    messages,
    messagesEndRef,
    setMessages,
    activeConversation,
    setActiveConversation,
    getConversationList,
    getActiveConversationMessages,
    resetConversationState,
    handleSendMessageMediaContext,
    pendingSendCount,
  } = useMedia();

  // Three states, kept apart on purpose: a link that is still resolving must not
  // look like a link that has been withdrawn.
  const [linkState, setLinkState] = useState('loading');
  const [avatarPortrait, setAvatarPortrait] = useState(null);
  // The composer's waveform button asks for this screen, the same way it does
  // in ChatArea. Without somewhere for it to ask, the button was inert here:
  // `onActivateLiveChat` was simply not passed, so pressing it did nothing at
  // all. A spoken turn is an ordinary turn with the recording attached, so it
  // travels the anonymous message stream this chat already uses.
  const [isLiveModeOpen, setIsLiveModeOpen] = useState(false);
  // Whether the lookup for this visitor's earlier chats with this avatar has
  // finished. The opening question is offered only for a conversation that is
  // genuinely empty, and the transcript is empty for the moment that lookup
  // takes as well — so without this the suggestion flashes on screen and is
  // then replaced by a restored thread.
  const [hasCheckedForEarlierChats, setHasCheckedForEarlierChats] =
    useState(false);

  useEffect(() => {
    let cancelled = false;
    // Whatever conversation was on screen belongs to a different avatar, and a
    // visitor arriving on a shared link starts with an empty transcript.
    resetConversationState();
    setAvatarPortrait(null);
    setLinkState('loading');
    setIsLiveModeOpen(false);
    setHasCheckedForEarlierChats(false);

    (async () => {
      try {
        const publicAvatars = await listPublicAvatars(avatarId);
        const sharedAvatar = (
          Array.isArray(publicAvatars) ? publicAvatars : []
        ).find((candidate) => resolveAssistantId(candidate) === avatarId);
        if (cancelled) return;

        if (!sharedAvatar) {
          setLinkState('unavailable');
          return;
        }

        // The message pipeline reads the open avatar from context, so putting it
        // there is what lets this screen reuse the composer, the streaming, and
        // the transcript exactly as the signed-in chat does.
        setActiveAvatar(sharedAvatar);
        setActiveConversation(NEW_CONVERSATION_ID);
        setMessages([]);
        setLinkState('ready');

        // Reopen the visitor's most recent chat with this avatar, the way the
        // signed-in chat opens the newest thread. A visitor who has never
        // written to this avatar — and one whose threads cannot be listed at
        // all — stays on the unsent conversation already set above, so a
        // failure here costs the history, never the chat.
        //
        // "The visitor's" means this browser's. The API resolves an anonymous
        // caller by network address, so the listing also contains guest chats
        // this reader never had — an earlier demo, another tab, or a stranger
        // sharing the address. Opening one of those as "your last conversation"
        // would hand someone else's chat to whoever followed the link.
        try {
          const visitorThreads = await getConversationList(null, sharedAvatar);
          if (cancelled) return;

          const threadsStartedHere = new Set(
            listRememberedSharedAvatarThreadIds(avatarId)
          );
          const newestThreadId =
            (visitorThreads ?? []).find((thread) =>
              threadsStartedHere.has(thread.thread_id)
            )?.thread_id ?? null;
          if (newestThreadId) {
            setActiveConversation(newestThreadId);
            await getActiveConversationMessages(
              null,
              sharedAvatar,
              newestThreadId
            );
          }
        } catch (historyError) {
          if (cancelled) return;
          console.debug(
            'Listing this visitor\'s chats with the avatar failed:',
            historyError
          );
        } finally {
          // Whether earlier chats were found, absent, or unlistable, the
          // question of what belongs on screen is now settled.
          if (!cancelled) setHasCheckedForEarlierChats(true);
        }

        try {
          const portrait = await getAvatarReferenceImage(avatarId, {
            asAnonymousIdentity: true,
          });
          if (!cancelled) setAvatarPortrait(portrait);
        } catch (portraitError) {
          // An avatar without a portrait is ordinary, and the placeholder face
          // is a better outcome than refusing to open the chat.
          console.debug('No portrait for the shared avatar:', portraitError);
        }
      } catch (lookupError) {
        if (cancelled) return;
        console.error('Opening the shared avatar failed:', lookupError);
        setLinkState('unavailable');
      }
    })();

    return () => {
      cancelled = true;
    };
    // Keyed on the avatar in the link alone. The context setters are rebuilt on
    // every render of their provider, so listing them would reload the chat
    // continuously.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarId]);

  // A thread the server mints for this reader is this browser's from the moment
  // it exists, and recording it is what lets the panel show their own chats and
  // nobody else's the next time the link is opened. It is written here rather
  // than at the send, because a thread arrives by two routes — the terminal
  // frame of a first message, and reopening one on a later visit — and both end
  // up in `activeConversation`.
  useEffect(() => {
    if (
      linkState === 'ready' &&
      activeConversation &&
      activeConversation !== NEW_CONVERSATION_ID
    ) {
      rememberSharedAvatarThread(avatarId, activeConversation);
    }
  }, [avatarId, activeConversation, linkState]);

  // Offered only for a conversation with nothing in it yet, and never while a
  // turn is already on its way — a second copy of the question sent by an
  // impatient double-tap would read as the visitor having asked twice.
  const isOfferingTheOpeningQuestion =
    linkState === 'ready' &&
    hasCheckedForEarlierChats &&
    messages.length === 0 &&
    pendingSendCount === 0;

  if (linkState === 'loading') {
    return <LoadingSpinner fullscreen label="Loading…" />;
  }

  if (linkState === 'unavailable') {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-black/60 backdrop-blur-lg rounded-2xl border border-white/10 p-6 text-center">
          <h1 className="text-xl font-semibold text-neutral-200 mb-2">
            This avatar is not available
          </h1>
          <p className="text-white/60 text-sm">
            The link may have been withdrawn by the person who shared it, or the
            address may be mistyped. Shared avatars stop responding the moment
            they are made private again.
          </p>
          <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center">
            <button
              onClick={() => openApplicationScreen('/signup')}
              className="px-4 py-2 rounded-lg bg-neutral-100/10 hover:bg-neutral-100/15 border border-neutral-700 text-neutral-200 font-semibold transition-colors"
            >
              Create your own avatar
            </button>
            <button
              onClick={() => openApplicationScreen('/welcome')}
              className="px-4 py-2 rounded-lg bg-black/50 hover:bg-white/10 border border-white/10 text-neutral-200 transition-colors"
            >
              About Neural Nexus
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    {isLiveModeOpen && (
      <LiveVoiceMode
        assistantId={avatarId}
        avatarName={activeAvatar?.name}
        avatarPortrait={avatarPortrait}
        onClose={() => setIsLiveModeOpen(false)}
      />
    )}
    <div className={`h-full w-full min-w-0 p-2 sm:p-4 ${isLiveModeOpen ? 'invisible pointer-events-none' : ''}`}>
      <div className="flex flex-col w-full h-full min-w-0 bg-black/60 backdrop-blur-lg rounded-2xl border border-white/10 overflow-hidden relative">
        {/* The header names the one avatar this link opens. There is nothing to
            switch to and nothing to administer, so it carries no tabs. */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 shrink-0 rounded-full bg-black/50 border border-white/10 overflow-hidden flex items-center justify-center">
              {avatarPortrait && isValidImageUrl(avatarPortrait) ? (
                <img
                  src={avatarPortrait}
                  alt={activeAvatar?.name ?? 'Avatar'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-5 h-5 text-white/40" />
              )}
            </div>
            <span className="text-neutral-200 font-semibold truncate">
              {activeAvatar?.name
                ? `A.I. ${activeAvatar.name} Chat`
                : 'A.I. Chat'}
            </span>
          </div>
          <button
            onClick={() => openApplicationScreen('/signup')}
            className="shrink-0 inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg bg-neutral-100/10 hover:bg-neutral-100/15 border border-neutral-700 text-neutral-200 text-xs sm:text-sm font-semibold transition-colors"
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Create your own avatar</span>
            <span className="sm:hidden">Sign up</span>
          </button>
        </div>

        <div className="flex flex-col flex-grow min-w-0 overflow-hidden">
          <div className="flex-grow overflow-y-auto overflow-x-hidden p-2 sm:p-4 relative min-w-0">
            {/* Same width as the composer below, so the transcript and the input
                share one column. */}
            <div className="w-full max-w-3xl mx-auto min-w-0">
              <MessageList
                messages={messages}
                messagesEndRef={messagesEndRef}
                avatarPortrait={avatarPortrait}
                avatarName={activeAvatar?.name}
                assistantId={avatarId}
              />

              {/* An empty chat asks a visitor to think of something to say to a
                  stranger, which is the moment most of them leave. One tap on
                  the question below spends that decision for them and puts the
                  avatar's own introduction on screen. It is offered rather than
                  sent automatically: the landing page frames this chat, and a
                  turn taken by everyone who merely scrolls past would be billed
                  and rate-limited as though they had all asked. */}
              {isOfferingTheOpeningQuestion && (
                <div className="flex flex-col items-center gap-4 py-8 px-2 text-center">
                  <p className="text-white/50 text-sm">
                    {activeAvatar?.name
                      ? `Say hello to A.I. ${activeAvatar.name}`
                      : 'Start the conversation'}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      handleSendMessageMediaContext(OPENING_QUESTION)
                    }
                    className="group w-full max-w-lg inline-flex items-start gap-3 text-left px-4 py-3 rounded-2xl bg-neutral-100/5 hover:bg-neutral-100/10 border border-neutral-700 hover:border-neutral-300/50 text-neutral-200 transition-colors duration-300"
                  >
                    <MessageCircle className="w-4 h-4 mt-1 shrink-0 text-neutral-300" />
                    <span className="text-sm sm:text-base">
                      {OPENING_QUESTION}
                    </span>
                  </button>
                  <p className="text-white/40 text-xs">
                    …or ask anything you like below.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex-shrink-0 min-w-0 mt-2">
            <InputBar
              avatar_id={avatarId}
              suggestionsEnabled={
                hasCheckedForEarlierChats && !isOfferingTheOpeningQuestion
              }
              onActivateLiveChat={() => setIsLiveModeOpen(true)}
            />
          </div>

          <p className="text-white/40 text-xs text-center px-4 pb-3 pt-1">
            You are chatting as a guest. Your chats with this avatar are kept
            against this network connection rather than an account — sign up to
            keep them wherever you sign in.
          </p>
        </div>
      </div>
    </div>
    </>
  );
};

export default SharedAvatarChat;
