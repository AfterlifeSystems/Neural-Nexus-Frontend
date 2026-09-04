// src/components/media/MessageActionBar.jsx
import React from 'react';
import {
  Check,
  Copy,
  MessageSquare,
  Pencil,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import SpeakButton from './SpeakButton';

export const ACTION_BUTTON_CLASSES =
  'inline-flex items-center justify-center p-0.5 rounded text-neutral-400 hover:text-neutral-100 hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:opacity-40';

/**
 * Format the screenshot metrics line: `4.6s • 8.4k tokens • $0.0012`.
 *
 * @param {Object} message An avatar message that may carry usage metadata.
 * @returns {string|null} The line, or null when nothing is known.
 */
export const formatMessageMetrics = (message) => {
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

/**
 * Copy, regenerate, rate, speak, edit, and retry — the same controls the
 * message list shows under a bubble.
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
  onToggleFeedback,
  onFeedbackDraftChange,
  onSubmitFeedback,
  onStartEdit,
  onRetry,
}) => {
  if (!message?.content) return null;

  const metrics = isFromAvatar ? formatMessageMetrics(message) : null;
  const showAvatarActions = isFromAvatar;
  const showUserActions =
    isFromUser && editingKey !== messageKey && !readOnly;
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
              onClick={() => onCopy(messageKey, message.content)}
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
                  className={`${ACTION_BUTTON_CLASSES} ${
                    message.feedback?.type === 'like' ? 'text-amber-300' : ''
                  }`}
                >
                  <ThumbsUp className="w-3 h-3" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={onDislike}
                  title="Bad"
                  aria-label="Bad response"
                  className={`${ACTION_BUTTON_CLASSES} ${
                    message.feedback?.type === 'dislike' ? 'text-amber-300' : ''
                  }`}
                >
                  <ThumbsDown className="w-3 h-3" aria-hidden="true" />
                </button>
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
                <SpeakButton
                  isSpeaking={isSpeaking}
                  isLoading={isSpeechLoading}
                  onToggle={onToggleSpeech}
                />
              </>
            )}
          </div>
        ) : showUserActions ? (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => onCopy(messageKey, message.content)}
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
        {timestamp && (
          <div
            className={`text-xs text-right select-none ml-auto ${
              overlay ? 'text-white/60' : 'text-neutral-400'
            }`}
          >
            {timestamp}
          </div>
        )}
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
            Select thumbs up or down before submitting
          </p>
          <button
            type="button"
            disabled={!message.feedback?.type || !feedbackDraft.trim()}
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
