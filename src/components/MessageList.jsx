// src/components/MessageList.jsx
import React, { useEffect } from 'react';
import { Square } from 'lucide-react';
import InterruptPanel from './InterruptPanel';
import ShareRequestPrompt from './ShareRequestPrompt';
import MessageMedia from './MessageMedia';
import { useLocation } from 'react-router-dom';
import { useMedia } from '../context/MediaContext';
import { useAuth } from '../context/AuthContext';
import { isSharedAvatarChatPath } from './utils';
import { canUseAvatarSpeechPlayback } from '../services/avatarSpeechPlayback';
import { shouldPromptForMissingClonedVoice } from '../services/missingClonedVoicePrompt';
import usePersonalAvatar from '../hooks/usePersonalAvatar';
import {
  SPEAKING_BUBBLE_HIGHLIGHT,
  speakingBubbleProps,
  userResponseIsSpeaking,
} from './speakingIndicator';
import BillingRefusalNotice, {
  BILLING_REFUSAL_MESSAGE_TYPE,
} from './BillingRefusalNotice';
import useEmotionMedia from '../hooks/useEmotionMedia';
import useAvatarFaceSource from '../hooks/useAvatarFaceSource';
import useMessageActions from '../hooks/useMessageActions';
import MessageActionBar from './media/MessageActionBar';
import MessageEditor from './messageEdit/MessageEditor';
import { isConversationSuggestionList } from '../services/conversationSuggestions';
import { messageKeyOf } from '../services/messageKey';
import AmbientNotificationCard from './AmbientNotificationCard';
import { isAmbientNotice, isNoticeDismissed } from '../services/ambientNotice';
import { noticeDecisionFor } from '../services/avatarPreferences';
import { focusComposer } from '../services/composerFocus';
import CreatedArtifacts from './CreatedArtifacts';
import ChartCard from './ChartCard';
import ConnectionCardStack from './connections/ConnectionCardStack';
import LinkifiedText from './ui/LinkifiedText';
import {
  connectionsOf,
  isConnectionCardOnly,
} from '../services/connectionCards';
import {
  artifactNamesRenderedByCharts,
  chartHasRenderableData,
  chartsOf,
  pngArtifactFor,
} from '../services/chartSpecs';
import ThirdPartySpeakerIcon from './ThirdPartySpeakerIcon';
import MessageAuthorIcon from './MessageAuthorIcon';
import {
  SPEAKER_ROLE_OTHER,
  speakerBubbleRowsOf,
  spokenTurnText,
} from './speakerScript';
import { voiceMessageIsGenerating } from './voiceCaptionVisibility';
import {
  createdArtifactsOf,
  speakableReplyText,
  stripArtifactReferences,
} from '../services/createdArtifacts';

/**
 * The scrolling box a descendant actually scrolls inside: the nearest ancestor
 * whose own overflow is scrollable, or the document itself when no element in
 * the chain scrolls. Deliberately stops at this document — a parent frame's
 * scroll position belongs to the page doing the embedding, not to the chat.
 *
 * @param {Element} descendantElement The element to scroll into view.
 * @returns {Element|null} The box to scroll, or null when there is none.
 */
const findNearestScrollingAncestor = (descendantElement) => {
  let candidate = descendantElement.parentElement;
  while (candidate) {
    const { overflowY } = window.getComputedStyle(candidate);
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      candidate.scrollHeight > candidate.clientHeight
    ) {
      return candidate;
    }
    candidate = candidate.parentElement;
  }
  return descendantElement.ownerDocument?.scrollingElement ?? null;
};

const MessageList = ({
  messages,
  messagesEndRef,
  avatarPortrait,
  avatarName,
  assistantId,
  readOnly = false,
  onAvatarPortraitClick,
}) => {
  const {
    assistantActivity,
    avatarPreferences,
    refreshAvatarPreferences,
    allowAmbientAction,
    noteNoticeInteraction,
    dismissNotice,
    dismissedNoticeIds,
    stopAssistantTurn,
    stoppableTurnCount,
  } = useMedia();
  // The composer's button never becomes Stop — an empty box has to keep
  // offering voice mode mid-reply — so the reply being generated carries its
  // own Stop, as the caption does in voice mode. A shared transcript is
  // read-only and has no turn of its own to end.
  const replyTurnIsStoppable = !readOnly && (stoppableTurnCount ?? 0) > 0;
  const renderStopReplyButton = () => (
    <button
      type="button"
      onClick={() => stopAssistantTurn?.()}
      title="Stop generating"
      aria-label="Stop generating"
      className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 text-white/80 text-xs border border-white/10 hover:text-neutral-100 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
    >
      <Square className="w-3 h-3 fill-current" />
      Stop
    </button>
  );
  const { userPortrait, activeAvatar, user } = useAuth();
  const location = useLocation();
  const readerIsAnonymous = isSharedAvatarChatPath(location.pathname);
  const canSpeak = canUseAvatarSpeechPlayback(activeAvatar, user, {
    pathname: location.pathname,
  });
  const { personalAvatar, personalAssistantId } = usePersonalAvatar();
  const canSpeakUser =
    !readerIsAnonymous &&
    canUseAvatarSpeechPlayback(personalAvatar, user, {
      pathname: location.pathname,
    });
  const resolvedAssistantId =
    assistantId ?? activeAvatar?.assistant_id ?? activeAvatar?.avatar_id;
  const { manifest: emotionMedia } = useEmotionMedia(resolvedAssistantId, {
    asAnonymousIdentity: readerIsAnonymous,
  });
  const { showGenerated } = useAvatarFaceSource(resolvedAssistantId);

  const {
    speech,
    pendingSendCount,
    loadingSpeechKey,
    copiedKey,
    editingKey,
    setEditingKey,
    editDraft,
    setEditDraft,
    feedbackKey,
    setFeedbackKey,
    feedbackDraft,
    setFeedbackDraft,
    toggleSpeech,
    copyMessage,
    resendFromUserMessage,
    regenerateAvatarReply,
    submitMessageFeedback,
  } = useMessageActions({
    assistantId: resolvedAssistantId,
    avatarName,
    asAnonymousIdentity: readerIsAnonymous,
    speechPlaybackEnabled: canSpeak,
    userSpeechPlaybackEnabled: canSpeakUser,
    userSpeechAssistantId: personalAssistantId,
    promptForMissingClonedVoice: shouldPromptForMissingClonedVoice({
      avatar: activeAvatar,
      user,
    }),
  });

  // Who the reader is on THIS screen, which is not always who this browser has
  // a session for. Every turn on a shared avatar's public chat is sent as the
  // anonymous visitor whatever credential is stored here, so showing the
  // signed-in account's face beside those messages claims the conversation for
  // an account that is not party to it — and is contradicted by the transcript
  // the server actually holds, which is the guest's.
  const readerIsTheAnonymousVisitor = isSharedAvatarChatPath(location.pathname);
  const readerPortrait = readerIsTheAnonymousVisitor ? null : userPortrait;
  const speakerOptions = { humanTurn: true, avatarName };

  useEffect(() => {
    const transcriptEndMarker = messagesEndRef?.current;
    if (!transcriptEndMarker) return;

    // Scroll the transcript's own scrolling box, not the marker's ancestry.
    // `scrollIntoView` walks every scrollable ancestor up to and through the
    // document of a parent frame, so on the landing page — which embeds this
    // chat as the live demo — it dragged the whole page down to the demo the
    // moment the frame mounted, past the headline nobody had read yet.
    const transcriptScrollBox =
      findNearestScrollingAncestor(transcriptEndMarker);
    if (!transcriptScrollBox) return;
    transcriptScrollBox.scrollTo({
      top: transcriptScrollBox.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, messagesEndRef]);

  return (
    <div className="flex-grow mb-4 space-y-2 px-2 flex flex-col min-w-0 w-full">
      {messages
        // Temporary relaxed filter – helps debug missing assistant messages
        // .filter((msg) => msg?.type || msg?.sender || msg?.isLoading)
        .map((msg) => {
          const isLoading = msg.isLoading || msg.isPending;

          // Prefer type, fall back to sender (old field name safety)
          const type = msg.type || 'user';

          const messageKey =
            messageKeyOf(msg) ?? `temp-${msg.timestamp || Date.now()}`;

          // Not something anybody said: the API refusing to carry the
          // conversation any further until billing is dealt with. It is a card
          // across the column rather than a bubble on one side.
          if (type === BILLING_REFUSAL_MESSAGE_TYPE) {
            return <BillingRefusalNotice key={messageKey} message={msg} />;
          }

          const isFromUser = type === 'user' || type === 'human';
          const isFromAvatar =
            type === 'ai' || type === 'assistant' || type === 'avatar';
          if (isFromAvatar && isConversationSuggestionList(msg.content)) {
            return null;
          }

          // Something the avatar noticed through ambient vision and decided
          // the person should hear about. It is the avatar's own message, but
          // it renders as a card: Ignore teaches the next triage to stay
          // quiet about this kind of scene, and an action button appears
          // only when the avatar offered to do something on the person's
          // behalf. Thumbs use the same grouping a chat bubble uses.
          if (isFromAvatar && isAmbientNotice(msg)) {
            if (isNoticeDismissed(msg, dismissedNoticeIds)) {
              return null;
            }
            return (
              <div
                key={messageKey}
                className="self-start w-full max-w-[85%] min-w-0"
              >
                <AmbientNotificationCard
                  message={msg}
                  assistantId={resolvedAssistantId}
                  avatarName={avatarName}
                  readOnly={readOnly}
                  onReply={() => focusComposer()}
                  storedDecision={noticeDecisionFor(avatarPreferences, msg)}
                  onRecorded={refreshAvatarPreferences}
                  onAllowAction={allowAmbientAction}
                  onInteract={noteNoticeInteraction}
                  onDismiss={dismissNotice}
                />
              </div>
            );
          }
          const noticedAmbiently =
            isFromAvatar && msg.ambient?.decision === 'respond';
          // The avatar carried out an offer the person allowed on a card.
          const actedOnRequest =
            isFromAvatar && msg.ambient?.decision === 'act';

          // A connect card with no words around the card — the pause the
          // avatar raised for an account, or a card placed from the "+"
          // menu — stands alone, without a bubble or a portrait beside an
          // empty box. The card is interactive while the message is the
          // current pause or the card still waits for a sign-in.
          if (isFromAvatar && isConnectionCardOnly(msg)) {
            return (
              <ConnectionCardStack
                key={messageKey}
                message={msg}
                assistantId={resolvedAssistantId}
                readOnly={readOnly}
              />
            );
          }
          const connectionCards = isFromAvatar ? connectionsOf(msg) : [];
          const charts = isFromAvatar
            ? chartsOf(msg).filter(chartHasRenderableData)
            : [];
          const createdArtifacts = isFromAvatar ? createdArtifactsOf(msg) : [];
          // Stop belongs on the reply while its words are still arriving:
          // the pending bubble, and the row whose tokens are streaming in.
          // Once the text is done the stream may stay open for analysis,
          // but there is nothing left to cut short.
          const isGeneratingThisReply =
            replyTurnIsStoppable &&
            voiceMessageIsGenerating(msg, { turnActive: true });
          const speakerRows =
            isFromUser && !isLoading && editingKey !== messageKey
              ? speakerBubbleRowsOf(msg, speakerOptions)
              : null;
          const humanScriptText = spokenTurnText(msg, speakerOptions);
          const bubbleText = isFromAvatar
            ? stripArtifactReferences(msg.content)
            : humanScriptText;
          const isSpeakingThis = speech.speakingKey === messageKey;
          const isUserSpeaking = userResponseIsSpeaking({
            messageKey,
            speakingKey: speech.speakingKey,
            isPending: Boolean(isFromUser && isLoading),
          });
          const userSpeakingBubble = isUserSpeaking
            ? speakingBubbleProps()
            : { className: '', style: undefined };

          const messageActionBar = (
            <MessageActionBar
              message={msg}
              messageKey={messageKey}
              isFromAvatar={isFromAvatar}
              isFromUser={isFromUser}
              avatarName={avatarName}
              readOnly={readOnly}
              isSpeaking={isSpeakingThis}
              isSpeechLoading={loadingSpeechKey === messageKey}
              canSpeak={canSpeak}
              canSpeakUser={canSpeakUser}
              copiedKey={copiedKey}
              feedbackKey={feedbackKey}
              feedbackDraft={feedbackDraft}
              editingKey={editingKey}
              pendingSendCount={pendingSendCount}
              onCopy={copyMessage}
              onToggleSpeech={() =>
                toggleSpeech(
                  messageKey,
                  isFromAvatar
                    ? speakableReplyText(msg.content)
                    : humanScriptText,
                  { forUser: isFromUser }
                )
              }
              onRegenerate={(key) => regenerateAvatarReply?.(key)}
              onLike={() =>
                submitMessageFeedback?.(messageKey, { type: 'like' })
              }
              onDislike={() =>
                submitMessageFeedback?.(messageKey, {
                  type: 'dislike',
                })
              }
              onFeelsReal={() =>
                submitMessageFeedback?.(messageKey, {
                  feels: 'feels_real',
                })
              }
              onFeelsOff={() =>
                submitMessageFeedback?.(messageKey, {
                  feels: 'feels_fake',
                })
              }
              onToggleFeedback={() => {
                setFeedbackKey((current) =>
                  current === messageKey ? null : messageKey
                );
                setFeedbackDraft(msg.feedback?.comment ?? '');
              }}
              onFeedbackDraftChange={setFeedbackDraft}
              onSubmitFeedback={() => {
                submitMessageFeedback?.(messageKey, {
                  comment: feedbackDraft.trim(),
                });
                setFeedbackKey(null);
              }}
              onStartEdit={() => {
                setEditingKey(messageKey);
                setEditDraft(humanScriptText);
              }}
              onRetry={(key) =>
                resendFromUserMessage?.(key, humanScriptText)
              }
            />
          );

          return (
            <React.Fragment key={messageKey}>
              {speakerRows
                ? speakerRows.map((row, index) => {
                    const isLast = index === speakerRows.length - 1;
                    const isGuest = row.role === SPEAKER_ROLE_OTHER;
                    return (
                      <div
                        key={`${messageKey}-${row.role}-${row.speaker}-${index}`}
                        className="flex items-end gap-2 max-w-[85%] min-w-0 self-end flex-row-reverse"
                      >
                        {isGuest ? (
                          <ThirdPartySpeakerIcon identity={row.identity} />
                        ) : (
                          <MessageAuthorIcon
                            portrait={readerPortrait}
                            name="You"
                            isSpeaking={isUserSpeaking}
                            assistantId={personalAssistantId}
                          />
                        )}
                        <div
                          className={`p-2 rounded-lg min-w-0 break-words [overflow-wrap:anywhere] bg-neutral-900 border text-neutral-200 ${
                            isGuest && row.identity?.fill ? '' : 'border-white/10'
                          } ${isUserSpeaking && !isGuest ? userSpeakingBubble.className : ''}`}
                          style={
                            isGuest
                              ? row.identity?.fill
                                ? { borderColor: row.identity.fill }
                                : undefined
                              : isUserSpeaking
                                ? userSpeakingBubble.style
                                : undefined
                          }
                        >
                          <div className="whitespace-pre-wrap">
                            <LinkifiedText text={row.text} />
                          </div>
                          {isLast ? (
                            <>
                              <MessageMedia media={msg.media} />
                              {messageActionBar}
                            </>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                : (
              <div
                className={`flex items-end gap-2 max-w-[85%] min-w-0 ${
                  isFromUser ? 'self-end flex-row-reverse' : 'self-start'
                } ${charts.length > 0 ? 'w-full' : ''}`}
              >
                {(isFromUser || isFromAvatar) && (
                  <MessageAuthorIcon
                    portrait={isFromUser ? readerPortrait : avatarPortrait}
                    name={isFromUser ? 'You' : (avatarName ?? 'Avatar')}
                    emotion={isFromAvatar ? msg.sentiment?.base_emotion : null}
                    emotionMedia={isFromAvatar ? emotionMedia : null}
                    showGenerated={showGenerated}
                    isSpeaking={isFromUser ? isUserSpeaking : isSpeakingThis}
                    assistantId={
                      isFromUser ? personalAssistantId : resolvedAssistantId
                    }
                    onClick={
                      isFromAvatar && typeof onAvatarPortraitClick === 'function'
                        ? onAvatarPortraitClick
                        : undefined
                    }
                  />
                )}
                <div
                  className={`p-2 rounded-lg min-w-0 break-words [overflow-wrap:anywhere] transition-all duration-150 ${
                    charts.length > 0 ? 'w-full flex-grow' : ''
                  } ${
                    isFromUser
                      ? `bg-neutral-900 border border-white/10 text-neutral-200 ${userSpeakingBubble.className}`
                      : isFromAvatar
                        ? `bg-black/60 border border-white/10 text-neutral-200 ${
                            isSpeakingThis ? SPEAKING_BUBBLE_HIGHLIGHT : ''
                          }`
                        : 'bg-black/60 border border-white/10 italic text-neutral-400'
                  }`}
                  style={isFromUser ? userSpeakingBubble.style : undefined}
                >
                  {isLoading ? (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex space-x-1">
                        <div
                          className="w-2 h-2 bg-white rounded-full animate-bounce"
                          style={{ animationDelay: '0ms' }}
                        />
                        <div
                          className="w-2 h-2 bg-white rounded-full animate-bounce"
                          style={{ animationDelay: '150ms' }}
                        />
                        <div
                          className="w-2 h-2 bg-white rounded-full animate-bounce"
                          style={{ animationDelay: '300ms' }}
                        />
                      </div>
                      {isGeneratingThisReply && renderStopReplyButton()}
                    </div>
                  ) : (
                    <>
                      {noticedAmbiently && (
                        <div className="mb-1 text-[11px] uppercase tracking-wide text-amber-300/80">
                          Noticed on your webcam or screen
                        </div>
                      )}
                      {actedOnRequest && (
                        <div className="mb-1 text-[11px] uppercase tracking-wide text-sky-300/80">
                          Done at your request
                        </div>
                      )}
                      {isFromUser && editingKey === messageKey ? (
                        <MessageEditor
                          value={editDraft}
                          onChange={setEditDraft}
                          pendingSendCount={pendingSendCount}
                          onAccept={() => {
                            const words = String(editDraft ?? '').trim();
                            if (!words) return;
                            resendFromUserMessage?.(messageKey, words);
                            setEditingKey(null);
                          }}
                          onCancel={() => setEditingKey(null)}
                        />
                      ) : (
                        bubbleText && (
                          <div className="whitespace-pre-wrap">
                            <LinkifiedText text={bubbleText} />
                          </div>
                        )
                      )}

                      {isFromAvatar && msg.stopped && (
                        <div className="mt-1 text-[11px] uppercase tracking-wide text-neutral-500">
                          Stopped
                        </div>
                      )}

                      {isGeneratingThisReply && (
                        <div className="mt-2">{renderStopReplyButton()}</div>
                      )}

                      {/* The plot and report an analysis turn produced. The
                          model's own attachment link to them is stripped from
                          the text above because a browser cannot fetch it;
                          this is where the files actually appear. */}
                      {/* The charts an analytics turn drew, interactive;
                          the PNG of each is left out of the file list
                          below and offered from the chart instead. */}
                      {charts.map((chart, index) => (
                        <ChartCard
                          key={chart.chart_id ?? `${messageKey}-chart-${index}`}
                          chart={chart}
                          pngArtifact={pngArtifactFor(chart, createdArtifacts)}
                        />
                      ))}
                      {isFromAvatar && (
                        <CreatedArtifacts
                          artifacts={createdArtifacts}
                          hiddenNames={artifactNamesRenderedByCharts(charts)}
                        />
                      )}

                      <MessageMedia media={msg.media} />

                      {messageActionBar}
                    </>
                  )}
                </div>
              </div>
                )}
              {/* The connect cards a reply carries — the record of an
                  account added during the turn, or the card a paused turn
                  is waiting on — under the words, not inside the bubble. */}
              {connectionCards.length > 0 && (
                <ConnectionCardStack
                  message={msg}
                  assistantId={resolvedAssistantId}
                  readOnly={readOnly}
                  className="self-start w-full max-w-[85%] min-w-0 pl-10"
                />
              )}
            </React.Fragment>
          );
        })}

      {/* The question a paused turn is asking, if one is. This sits where the
          assistant's next message would have gone. A fact review starts folded
          so the conversation is not forced through the form; the choices live
          on the pause itself so switching between talking and typing keeps them. */}
      <ShareRequestPrompt />
      <InterruptPanel />

      {/* What the avatar is doing, for as long as it is doing it.
          This sits outside the message bubbles on purpose. The bouncing-dots
          indicator lives inside the pending message and vanishes the moment the
          first token lands — but the longest silence of a turn comes AFTER the
          text, while the reply is analysed. Tying the status to the dots would
          hide it during exactly the pause that makes a working avatar look
          stuck. */}
      {assistantActivity && (
        <div className="self-start flex items-center gap-2 px-2 py-1 text-xs text-white/70 italic">
          <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
          {assistantActivity}…
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;
