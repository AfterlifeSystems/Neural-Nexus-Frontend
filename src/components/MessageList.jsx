// src/components/MessageList.jsx
import React, { useEffect } from 'react';
import { User } from 'lucide-react';
import SecureImage from './SecureImage';
import InterruptPanel from './InterruptPanel';
import { useLocation } from 'react-router-dom';
import { useMedia } from '../context/MediaContext';
import { useAuth } from '../context/AuthContext';
import { isValidImageUrl, isSharedAvatarChatPath } from './utils';
import BillingRefusalNotice, {
  BILLING_REFUSAL_MESSAGE_TYPE,
} from './BillingRefusalNotice';
import useEmotionMedia, { stillFor } from '../hooks/useEmotionMedia';
import useMessageActions from '../hooks/useMessageActions';
import MessageActionBar from './media/MessageActionBar';
import { isConversationSuggestionList } from '../services/conversationSuggestions';
import AmbientNotificationCard from './AmbientNotificationCard';

/**
 * The face beside a message: whoever said it.
 *
 * Both sides get one so a long conversation stays readable at a glance without
 * relying on which edge a bubble is stuck to. A portrait is often absent — a
 * new avatar has none until one is uploaded — so the placeholder is the normal
 * case rather than an error state.
 *
 * For the avatar's replies the face follows the reply: when the reply's
 * classified emotion is not neutral and the avatar has a generated still for
 * that emotion, that still is shown in place of the portrait, so a joyful
 * answer is delivered by a joyful face.
 */
export const MessageAuthorIcon = ({ portrait, name, emotion, emotionMedia }) => {
  const emotionStill =
    emotion && emotion !== 'neutral' ? stillFor(emotionMedia, emotion) : null;
  const face = emotionStill ?? portrait;
  return (
    <div
      className="w-8 h-8 shrink-0 rounded-full bg-black/50 border border-white/10 overflow-hidden flex items-center justify-center"
      title={emotionStill ? emotion : undefined}
    >
      {face && isValidImageUrl(face) ? (
        <img
          src={face}
          alt={emotionStill ? `${name} (${emotion})` : name}
          className="w-full h-full object-cover transition-opacity duration-300"
        />
      ) : (
        <User className="w-4 h-4 text-white/40" />
      )}
    </div>
  );
};

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
}) => {
  const { assistantActivity } = useMedia();
  const { userPortrait, activeAvatar } = useAuth();
  const location = useLocation();
  const readerIsAnonymous = isSharedAvatarChatPath(location.pathname);
  const resolvedAssistantId =
    assistantId ?? activeAvatar?.assistant_id ?? activeAvatar?.avatar_id;
  const { manifest: emotionMedia } = useEmotionMedia(resolvedAssistantId, {
    asAnonymousIdentity: readerIsAnonymous,
  });

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
  });

  // Who the reader is on THIS screen, which is not always who this browser has
  // a session for. Every turn on a shared avatar's public chat is sent as the
  // anonymous visitor whatever credential is stored here, so showing the
  // signed-in account's face beside those messages claims the conversation for
  // an account that is not party to it — and is contradicted by the transcript
  // the server actually holds, which is the guest's.
  const readerIsTheAnonymousVisitor = isSharedAvatarChatPath(location.pathname);
  const readerPortrait = readerIsTheAnonymousVisitor ? null : userPortrait;

  useEffect(() => {
    const transcriptEndMarker = messagesEndRef?.current;
    if (!transcriptEndMarker) return;

    // Scroll the transcript's own scrolling box, not the marker's ancestry.
    // `scrollIntoView` walks every scrollable ancestor up to and through the
    // document of a parent frame, so on the landing page — which embeds this
    // chat as the live demo — it dragged the whole page down to the demo the
    // moment the frame mounted, past the headline nobody had read yet.
    const transcriptScrollBox = findNearestScrollingAncestor(
      transcriptEndMarker
    );
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

          const messageKey = msg.id || `temp-${msg.timestamp || Date.now()}`;

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
          // it renders as a card with the Agent Inbox choices — dismiss or
          // reply — rather than as a bubble in the exchange.
          if (isFromAvatar && msg.ambient?.decision === 'notify') {
            return (
              <div key={messageKey} className="self-start w-full max-w-[85%] min-w-0">
                <AmbientNotificationCard
                  message={msg}
                  assistantId={resolvedAssistantId}
                  avatarName={avatarName}
                  readOnly={readOnly}
                  onReply={() => {
                    document
                      .querySelector('[data-composer-input], textarea')
                      ?.focus();
                  }}
                />
              </div>
            );
          }
          const noticedAmbiently =
            isFromAvatar && msg.ambient?.decision === 'respond';

          return (
            <div
              key={messageKey}
              className={`flex items-end gap-2 max-w-[85%] min-w-0 ${
                  isFromUser ? 'self-end flex-row-reverse' : 'self-start'
                }`}
              >
                {(isFromUser || isFromAvatar) && (
                  <MessageAuthorIcon
                    portrait={isFromUser ? readerPortrait : avatarPortrait}
                    name={isFromUser ? 'You' : (avatarName ?? 'Avatar')}
                    emotion={isFromAvatar ? msg.sentiment?.base_emotion : null}
                    emotionMedia={isFromAvatar ? emotionMedia : null}
                  />
                )}
                <div
                  className={`p-2 rounded-lg min-w-0 break-words [overflow-wrap:anywhere] transition-all duration-150 ${
                    isFromUser
                      ? 'bg-neutral-900 border border-white/10 text-neutral-200'
                      : isFromAvatar
                        ? 'bg-black/60 border border-white/10 text-neutral-200'
                        : 'bg-black/60 border border-white/10 italic text-neutral-400'
                  }`}
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
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
                    </div>
                  ) : (
                    <>
                      {noticedAmbiently && (
                        <div className="mb-1 text-[11px] uppercase tracking-wide text-amber-300/80">
                          Noticed on your webcam or screen
                        </div>
                      )}
                      {isFromUser && editingKey === messageKey ? (
                        <div className="space-y-2">
                          <textarea
                            value={editDraft}
                            onChange={(event) => setEditDraft(event.target.value)}
                            rows={3}
                            className="w-full px-2 py-1.5 bg-black/50 border border-white/10 rounded-md text-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={pendingSendCount > 0 || !editDraft.trim()}
                              onClick={() => {
                                resendFromUserMessage?.(messageKey, editDraft);
                                setEditingKey(null);
                              }}
                              className="px-2 py-1 rounded-md bg-amber-400/15 text-amber-300 text-xs border border-amber-400/30"
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingKey(null)}
                              className="px-2 py-1 rounded-md bg-white/5 text-white/70 text-xs border border-white/10"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        msg.content && (
                          <div className="whitespace-pre-wrap">{msg.content}</div>
                        )
                      )}

                      {msg.media?.length > 0 &&
                        msg.media.map((media, index) => (
                          <div
                            key={media.id || media.filename || index}
                            className="mt-2"
                          >
                            {media.type === 'image' ||
                            media.content_type?.startsWith('image/') ? (
                              <SecureImage
                                mediaUrl={media.url}
                                filename={media.filename || media.name}
                              />
                            ) : media.type === 'audio' ||
                              media.content_type?.startsWith('audio/') ? (
                              <audio controls src={media.url} />
                            ) : media.type === 'video' ||
                              media.content_type?.startsWith('video/') ? (
                              <video
                                controls
                                className="max-w-full max-h-64"
                                src={media.url}
                              />
                            ) : (
                              <a
                                href={media.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline text-amber-300"
                              >
                                {media.filename ||
                                  media.name ||
                                  'Download file'}
                              </a>
                            )}
                          </div>
                        ))}

                      <MessageActionBar
                        message={msg}
                        messageKey={messageKey}
                        isFromAvatar={isFromAvatar}
                        isFromUser={isFromUser}
                        readOnly={readOnly}
                        isSpeaking={speech.speakingKey === messageKey}
                        isSpeechLoading={loadingSpeechKey === messageKey}
                        copiedKey={copiedKey}
                        feedbackKey={feedbackKey}
                        feedbackDraft={feedbackDraft}
                        editingKey={editingKey}
                        pendingSendCount={pendingSendCount}
                        onCopy={copyMessage}
                        onToggleSpeech={() =>
                          toggleSpeech(messageKey, msg.content)
                        }
                        onRegenerate={(key) => regenerateAvatarReply?.(key)}
                        onLike={() =>
                          submitMessageFeedback?.(messageKey, {
                            type: 'like',
                            comment: msg.feedback?.comment,
                          })
                        }
                        onDislike={() =>
                          submitMessageFeedback?.(messageKey, {
                            type: 'dislike',
                            comment: msg.feedback?.comment,
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
                            type: msg.feedback.type,
                            comment: feedbackDraft.trim(),
                          });
                          setFeedbackKey(null);
                        }}
                        onStartEdit={() => {
                          setEditingKey(messageKey);
                          setEditDraft(msg.content);
                        }}
                        onRetry={(key) => resendFromUserMessage?.(key)}
                      />
                    </>
                  )}
                </div>
              </div>
          );
        })}

      {/* The question a paused turn is asking, if one is. This sits where the
          assistant's next message would have gone, because that is what it
          stands in for: the turn produced this instead of a reply, and cannot
          continue until it is answered. */}
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
