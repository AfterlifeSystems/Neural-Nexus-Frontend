// src/components/MessageList.jsx
import React, { useEffect } from 'react';
import {
  Check,
  Copy,
  MessageSquare,
  Pencil,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  User,
} from 'lucide-react';
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
import useSpeech from '../hooks/useSpeech';
import SpeakButton from './media/SpeakButton';
import { showVoiceNotReadyToast } from './showVoiceNotReadyToast';
import { toast } from 'react-hot-toast';
import { isConversationSuggestionList } from '../services/conversationSuggestions';

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

const ACTION_BUTTON_CLASSES =
  'inline-flex items-center justify-center p-0.5 rounded text-neutral-400 hover:text-neutral-100 hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:opacity-40';

/**
 * Format the screenshot metrics line: `4.6s • 8.4k tokens • $0.0012`.
 *
 * @param {Object} message An avatar message that may carry usage metadata.
 * @returns {string|null} The line, or null when nothing is known.
 */
const formatMessageMetrics = (message) => {
  const parts = [];
  const timeMs =
    message?.total_response_time_ms ?? message?.usage?.latency_ms ?? null;
  if (Number.isFinite(Number(timeMs)) && Number(timeMs) > 0) {
    parts.push(`${(Number(timeMs) / 1000).toFixed(1)}s`);
  }
  const tokens = Number(
    message?.usage?.total_tokens ??
      message?.response_metadata?.token_usage?.total_tokens ??
      0
  );
  if (tokens > 0) {
    parts.push(
      tokens >= 1000
        ? `${(tokens / 1000).toFixed(tokens >= 10_000 ? 0 : 1)}k tokens`
        : `${tokens} tokens`
    );
  }
  const cost = Number(
    message?.response_metadata?.total_cost ?? message?.usage?.cost_usd ?? NaN
  );
  if (Number.isFinite(cost) && cost > 0) {
    parts.push(`$${cost < 0.01 ? cost.toFixed(4) : cost.toFixed(3)}`);
  }
  return parts.length ? parts.join(' • ') : null;
};

const MessageList = ({
  messages,
  messagesEndRef,
  avatarPortrait,
  avatarName,
  assistantId,
  readOnly = false,
}) => {
  const {
    assistantActivity,
    resendFromUserMessage,
    regenerateAvatarReply,
    submitMessageFeedback,
    pendingSendCount,
  } = useMedia();
  const { userPortrait, activeAvatar } = useAuth();
  const location = useLocation();
  const readerIsAnonymous = isSharedAvatarChatPath(location.pathname);
  const resolvedAssistantId =
    assistantId ?? activeAvatar?.assistant_id ?? activeAvatar?.avatar_id;
  const { manifest: emotionMedia } = useEmotionMedia(resolvedAssistantId, {
    asAnonymousIdentity: readerIsAnonymous,
  });

  // One voice at a time across the whole transcript: the speak buttons share
  // this session, so starting one message stops another.
  const speech = useSpeech({ asAnonymousIdentity: readerIsAnonymous });
  const [loadingSpeechKey, setLoadingSpeechKey] = React.useState(null);
  const [copiedKey, setCopiedKey] = React.useState(null);
  const [editingKey, setEditingKey] = React.useState(null);
  const [editDraft, setEditDraft] = React.useState('');
  const [feedbackKey, setFeedbackKey] = React.useState(null);
  const [feedbackDraft, setFeedbackDraft] = React.useState('');
  useEffect(() => {
    if (speech.notReady) {
      showVoiceNotReadyToast({
        assistantId: resolvedAssistantId,
        avatarName,
        collectedSeconds: speech.notReady.collectedSeconds,
      });
    }
  }, [speech.notReady, avatarName, resolvedAssistantId]);

  const toggleSpeech = async (messageKey, text) => {
    if (speech.speakingKey === messageKey) {
      speech.stop();
      return;
    }
    setLoadingSpeechKey(messageKey);
    try {
      await speech.speak(resolvedAssistantId, text, { key: messageKey });
    } finally {
      setLoadingSpeechKey(null);
    }
  };

  const copyMessage = async (messageKey, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(messageKey);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      toast.error('Could not copy.');
    }
  };

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
    <div className="flex-grow mb-4 space-y-2 px-2 flex flex-col">
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

          return (
            <div
              key={messageKey}
              className={`flex items-end gap-2 max-w-[85%] ${
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
                  className={`p-2 rounded-lg break-words transition-all duration-150 ${
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

                      {isFromAvatar && formatMessageMetrics(msg) && (
                        <p className="mt-2 text-xs text-white/40 text-right select-none">
                          {formatMessageMetrics(msg)}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 mt-1">
                        {isFromAvatar && msg.content ? (
                          <div className="flex flex-wrap items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => copyMessage(messageKey, msg.content)}
                              title="Copy"
                              aria-label="Copy message"
                              className={ACTION_BUTTON_CLASSES}
                            >
                              {copiedKey === messageKey ? (
                                <Check className="w-3 h-3" aria-hidden="true" />
                              ) : (
                                <Copy className="w-3 h-3" aria-hidden="true" />
                              )}
                            </button>
                            {!readOnly && (
                              <>
                            <button
                              type="button"
                              disabled={pendingSendCount > 0}
                              onClick={() => regenerateAvatarReply?.(messageKey)}
                              title="Regenerate"
                              aria-label="Regenerate response"
                              className={ACTION_BUTTON_CLASSES}
                            >
                              <RefreshCw className="w-3 h-3" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                submitMessageFeedback?.(messageKey, {
                                  type: 'like',
                                  comment: msg.feedback?.comment,
                                })
                              }
                              title="Good"
                              aria-label="Good response"
                              className={`${ACTION_BUTTON_CLASSES} ${
                                msg.feedback?.type === 'like'
                                  ? 'text-amber-300'
                                  : ''
                              }`}
                            >
                              <ThumbsUp className="w-3 h-3" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                submitMessageFeedback?.(messageKey, {
                                  type: 'dislike',
                                  comment: msg.feedback?.comment,
                                })
                              }
                              title="Bad"
                              aria-label="Bad response"
                              className={`${ACTION_BUTTON_CLASSES} ${
                                msg.feedback?.type === 'dislike'
                                  ? 'text-amber-300'
                                  : ''
                              }`}
                            >
                              <ThumbsDown className="w-3 h-3" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setFeedbackKey((current) =>
                                  current === messageKey ? null : messageKey
                                );
                                setFeedbackDraft(msg.feedback?.comment ?? '');
                              }}
                              title="Feedback"
                              aria-label="Send feedback"
                              className={`${ACTION_BUTTON_CLASSES} ${
                                feedbackKey === messageKey
                                  ? 'text-sky-300'
                                  : ''
                              }`}
                            >
                              <MessageSquare className="w-3 h-3" aria-hidden="true" />
                            </button>
                            <SpeakButton
                              isSpeaking={speech.speakingKey === messageKey}
                              isLoading={loadingSpeechKey === messageKey}
                              onToggle={() => toggleSpeech(messageKey, msg.content)}
                            />
                              </>
                            )}
                          </div>
                        ) : isFromUser && msg.content && editingKey !== messageKey && !readOnly ? (
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => copyMessage(messageKey, msg.content)}
                              title="Copy"
                              aria-label="Copy message"
                              className={ACTION_BUTTON_CLASSES}
                            >
                              {copiedKey === messageKey ? (
                                <Check className="w-3 h-3" aria-hidden="true" />
                              ) : (
                                <Copy className="w-3 h-3" aria-hidden="true" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingKey(messageKey);
                                setEditDraft(msg.content);
                              }}
                              title="Edit"
                              aria-label="Edit message"
                              className={ACTION_BUTTON_CLASSES}
                            >
                              <Pencil className="w-3 h-3" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              disabled={pendingSendCount > 0}
                              onClick={() => resendFromUserMessage?.(messageKey)}
                              title="Retry"
                              aria-label="Resend message"
                              className={ACTION_BUTTON_CLASSES}
                            >
                              <RefreshCw className="w-3 h-3" aria-hidden="true" />
                            </button>
                          </div>
                        ) : (
                          <span />
                        )}
                        <div className="text-xs text-neutral-400 text-right select-none ml-auto">
                          {msg.timestamp &&
                            new Date(msg.timestamp).toLocaleTimeString(
                              undefined,
                              {
                                hour: '2-digit',
                                minute: '2-digit',
                              }
                            )}
                        </div>
                      </div>
                      {isFromAvatar && !readOnly && feedbackKey === messageKey && (
                        <div className="mt-2 space-y-1">
                          <textarea
                            value={feedbackDraft}
                            onChange={(event) =>
                              setFeedbackDraft(event.target.value)
                            }
                            placeholder="Add feedback about this response..."
                            rows={2}
                            className="w-full px-2 py-1.5 bg-black/50 border border-white/10 rounded-md text-neutral-200 text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                          />
                          <p className="text-xs text-white/40">
                            Select thumbs up or down before submitting
                          </p>
                          <button
                            type="button"
                            disabled={
                              !msg.feedback?.type || !feedbackDraft.trim()
                            }
                            onClick={() => {
                              submitMessageFeedback?.(messageKey, {
                                type: msg.feedback.type,
                                comment: feedbackDraft.trim(),
                              });
                              setFeedbackKey(null);
                            }}
                            className="px-2 py-1 rounded-md bg-sky-500/20 text-sky-200 text-xs border border-sky-400/30 disabled:opacity-40"
                          >
                            Submit feedback
                          </button>
                        </div>
                      )}
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
