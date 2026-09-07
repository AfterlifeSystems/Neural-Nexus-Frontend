// src/components/media/MessageActionBar.jsx
import React from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  Ghost,
  MessageSquare,
  Pencil,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useMedia } from '../../context/MediaContext';
import {
  langsmithDebugLinkFor,
  shortenThreadId,
} from '../../config/langsmithDebug';
import SpeakButton from './SpeakButton';
import { editableScriptText } from '../speakerScript';
import { formatMessageMetrics } from '../../services/messageResponseMetrics';

export { formatMessageMetrics };

export const ACTION_BUTTON_CLASSES =
  'inline-flex items-center justify-center p-0.5 rounded text-neutral-400 hover:text-neutral-100 hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:opacity-40';

// A reaction the person has chosen. The glyph is filled and sits on a tinted
// pill so the choice reads as pressed at a glance and stays that way after a
// refresh, rather than as a faint colour change on a 12-pixel outline.
const PRESSED_REACTION_CLASSES = {
  like: 'text-amber-300 bg-amber-400/20 ring-1 ring-amber-400/60 hover:text-amber-200 hover:bg-amber-400/25',
  dislike:
    'text-amber-300 bg-amber-400/20 ring-1 ring-amber-400/60 hover:text-amber-200 hover:bg-amber-400/25',
  feels_real:
    'text-emerald-300 bg-emerald-400/20 ring-1 ring-emerald-400/60 hover:text-emerald-200 hover:bg-emerald-400/25',
  feels_fake:
    'text-rose-300 bg-rose-400/20 ring-1 ring-rose-400/60 hover:text-rose-200 hover:bg-rose-400/25',
};

/**
 * Class list for a reaction button: the shared action style, plus the
 * pressed style when the person chose this reaction.
 *
 * @param {'like'|'dislike'|'feels_real'|'feels_fake'} reaction
 * @param {boolean} pressed
 * @returns {string}
 */
export function reactionButtonClasses(reaction, pressed) {
  return pressed
    ? `${ACTION_BUTTON_CLASSES} ${PRESSED_REACTION_CLASSES[reaction]}`
    : ACTION_BUTTON_CLASSES;
}

/**
 * Copy, regenerate, rate, speak, edit, and retry — the same controls the
 * message list shows under a bubble. In Vite development, the administrator
 * also gets a LangSmith link to this conversation's thread.
 *
 * @param {Object} parameters
 * @param {Object} parameters.message The transcript row.
 * @param {string} parameters.messageKey Stable id for copy/speech/feedback.
 * @param {boolean} parameters.isFromAvatar Whether this is an assistant reply.
 * @param {boolean} parameters.isFromUser Whether this is the reader's turn.
 * @param {boolean} [parameters.readOnly] Hide mutate actions (shared thread).
 * @param {boolean} [parameters.overlay] Chip background for captions on a stage.
 * @param {boolean} parameters.isSpeaking Whether this row's speech is playing.
 * @param {boolean} parameters.isSpeechLoading Whether its audio is being fetched.
 * @param {boolean} [parameters.canSpeak] Whether speak-aloud is offered for this avatar.
 * @param {string|null} parameters.copiedKey Which row was just copied.
 * @param {string|null} parameters.feedbackKey Which row's comment box is open.
 * @param {string} parameters.feedbackDraft The open comment.
 * @param {string|null} parameters.editingKey Which user row is being edited.
 * @param {number} parameters.pendingSendCount In-flight sends; disables retry.
 * @param {Function} parameters.onCopy
 * @param {Function} parameters.onToggleSpeech
 * @param {Function} parameters.onRegenerate
 * @param {Function} parameters.onLike
 * @param {Function} parameters.onDislike
 * @param {Function} [parameters.onFeelsReal] Mark this reply as feeling like the real person.
 * @param {Function} [parameters.onFeelsOff] Mark this reply as feeling fake or off.
 * @param {Function} parameters.onToggleFeedback
 * @param {Function} parameters.onFeedbackDraftChange
 * @param {Function} parameters.onSubmitFeedback
 * @param {Function} parameters.onStartEdit
 * @param {Function} parameters.onRetry
 */
const MessageActionBar = ({
  message,
  messageKey,
  isFromAvatar,
  isFromUser,
  readOnly = false,
  overlay = false,
  isSpeaking,
  isSpeechLoading,
  canSpeak = false,
  copiedKey,
  feedbackKey,
  feedbackDraft,
  editingKey,
  pendingSendCount,
  onCopy,
  onToggleSpeech,
  onRegenerate,
  onLike,
  onDislike,
  onFeelsReal,
  onFeelsOff,
  onToggleFeedback,
  onFeedbackDraftChange,
  onSubmitFeedback,
  onStartEdit,
  onRetry,
}) => {
  const { user } = useAuth();
  const { activeConversation } = useMedia();
  // The reply's own run when the API reported one, so the link lands on this
  // turn inside the thread rather than on the thread's newest run.
  const langsmithHref = langsmithDebugLinkFor(
    user,
    activeConversation,
    message?.run_id ?? null
  );

  const actionText = editableScriptText(message);
  if (!actionText) return null;

  const metrics = isFromAvatar ? formatMessageMetrics(message) : null;
  // The reactions the person chose on this reply, kept on the row by the
  // stored preferences, so a lit button is a stored one.
  const liked = message.feedback?.type === 'like';
  const disliked = message.feedback?.type === 'dislike';
  const feltReal = message.feedback?.feels === 'feels_real';
  const feltOff = message.feedback?.feels === 'feels_fake';
  const showAvatarActions = isFromAvatar;
  const showUserActions = isFromUser && editingKey !== messageKey && !readOnly;
  const timestamp = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <>
      {metrics && (
        <p
          className={`mt-2 text-xs text-right select-none ${
            overlay ? 'text-white/55 drop-shadow' : 'text-white/40'
          }`}
        >
          {metrics}
        </p>
      )}
      <div
        className={`flex flex-wrap items-center justify-between gap-2 mt-1 caption-actions ${
          overlay ? 'rounded-lg bg-black/45 backdrop-blur-sm px-1.5 py-1' : ''
        }`}
      >
        {showAvatarActions ? (
          <div className="flex flex-wrap items-center gap-0.5">
            <button
              type="button"
              onClick={() => onCopy(messageKey, actionText)}
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
                  onClick={() => onRegenerate(messageKey)}
                  title="Regenerate"
                  aria-label="Regenerate response"
                  className={ACTION_BUTTON_CLASSES}
                >
                  <RefreshCw className="w-3 h-3" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={onLike}
                  title="Good"
                  aria-label="Good response"
                  aria-pressed={liked}
                  className={reactionButtonClasses('like', liked)}
                >
                  <ThumbsUp
                    className="w-3 h-3"
                    fill={liked ? 'currentColor' : 'none'}
                    aria-hidden="true"
                  />
                </button>
                <button
                  type="button"
                  onClick={onDislike}
                  title="Bad"
                  aria-label="Bad response"
                  aria-pressed={disliked}
                  className={reactionButtonClasses('dislike', disliked)}
                >
                  <ThumbsDown
                    className="w-3 h-3"
                    fill={disliked ? 'currentColor' : 'none'}
                    aria-hidden="true"
                  />
                </button>
                {onFeelsReal && (
                  <button
                    type="button"
                    onClick={onFeelsReal}
                    title="Feels real"
                    aria-label="This feels real"
                    aria-pressed={feltReal}
                    className={reactionButtonClasses('feels_real', feltReal)}
                  >
                    <Sparkles
                      className="w-3 h-3"
                      fill={feltReal ? 'currentColor' : 'none'}
                      aria-hidden="true"
                    />
                  </button>
                )}
                {onFeelsOff && (
                  <button
                    type="button"
                    onClick={onFeelsOff}
                    title="Feels off"
                    aria-label="This feels off"
                    aria-pressed={feltOff}
                    className={reactionButtonClasses('feels_fake', feltOff)}
                  >
                    <Ghost
                      className="w-3 h-3"
                      fill={feltOff ? 'currentColor' : 'none'}
                      aria-hidden="true"
                    />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onToggleFeedback}
                  title="Feedback"
                  aria-label="Send feedback"
                  className={`${ACTION_BUTTON_CLASSES} ${
                    feedbackKey === messageKey ? 'text-sky-300' : ''
                  }`}
                >
                  <MessageSquare className="w-3 h-3" aria-hidden="true" />
                </button>
                {canSpeak && (
                  <SpeakButton
                    isSpeaking={isSpeaking}
                    isLoading={isSpeechLoading}
                    onToggle={onToggleSpeech}
                  />
                )}
              </>
            )}
          </div>
        ) : showUserActions ? (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => onCopy(messageKey, actionText)}
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
              onClick={onStartEdit}
              title="Edit"
              aria-label="Edit message"
              className={ACTION_BUTTON_CLASSES}
            >
              <Pencil className="w-3 h-3" aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={pendingSendCount > 0}
              onClick={() => onRetry(messageKey)}
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
        <div className="flex items-center gap-2 ml-auto">
          {langsmithHref && (
            <a
              href={langsmithHref}
              target="_blank"
              rel="noopener noreferrer"
              title={
                message?.run_id
                  ? `Open this reply's run in LangSmith`
                  : `Open thread ${activeConversation} in LangSmith`
              }
              aria-label={`Open conversation thread ${activeConversation} in LangSmith`}
              className={`${ACTION_BUTTON_CLASSES} gap-1 text-[11px] font-mono ${
                overlay ? 'text-amber-200/80' : 'text-amber-300/80'
              }`}
            >
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
              <span>LangSmith · {shortenThreadId(activeConversation)}</span>
            </a>
          )}
          {timestamp && (
            <div
              className={`text-xs text-right select-none ${
                overlay ? 'text-white/60' : 'text-neutral-400'
              }`}
            >
              {timestamp}
            </div>
          )}
        </div>
      </div>
      {isFromAvatar && !readOnly && feedbackKey === messageKey && (
        <div className="mt-2 space-y-1 caption-actions">
          <textarea
            value={feedbackDraft}
            onChange={(event) => onFeedbackDraftChange(event.target.value)}
            placeholder="Add feedback about this response..."
            rows={2}
            className="w-full px-2 py-1.5 bg-black/50 border border-white/10 rounded-md text-neutral-200 text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
          />
          <p className="text-xs text-white/40">
            Your note teaches the avatar from the very next reply. Thumbs and
            feels-real marks are optional.
          </p>
          <button
            type="button"
            disabled={!feedbackDraft.trim()}
            onClick={onSubmitFeedback}
            className="voice-text-btn px-2 py-1 rounded-md bg-sky-500/20 text-sky-200 text-xs border border-sky-400/30 disabled:opacity-40"
          >
            Submit feedback
          </button>
        </div>
      )}
    </>
  );
};

export default MessageActionBar;
