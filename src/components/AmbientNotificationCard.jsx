// src/components/AmbientNotificationCard.jsx
import React, { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  Loader2,
  MessageSquare,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { recordAmbientPreference } from '../services/avatarService';
import {
  COLLAPSE_NOTICE_TOOLTIP,
  DISLIKE_NOTICE_TOOLTIP,
  DISMISS_NOTICE_TOOLTIP,
  EXPAND_NOTICE_TOOLTIP,
  IGNORE_NOTICE_TOOLTIP,
  LIKE_NOTICE_TOOLTIP,
  ambientPreferenceForNoticeRating,
  ambientPreferencePayload,
  noticeClickTogglesCard,
  noticeHasSomethingToReplyTo,
  noticeOffer,
  noticePreview,
  noticeShowsIgnoreAction,
} from '../services/ambientNotice';
import { ACTION_BUTTON_CLASSES } from './media/MessageActionBar';

/**
 * The card the avatar posts when ambient vision saw something the person
 * should hear about.
 *
 * The message itself is an ordinary reply from the avatar; what makes it a
 * card is the triage record the API attaches to the reply
 * (`response_metadata.ambient` with `decision: "notify"`). Feedback uses the
 * same thumbs grouping as a chat bubble: like is `accept` (more notices like
 * this), dislike is `ignore` (fewer). The comment box is the standing note
 * the next triage reads as precedent. Ignore records that same preference
 * and takes the notice off the screen — that is the button on a plain
 * heads-up, where the avatar has nothing to reply to. Reply appears only
 * when the offer is a waiting message, email, or call the person can answer
 * themselves; it moves focus to the composer and records that the person
 * replied in person. When the triage named something the avatar will do on
 * the conversation partner's behalf, the card shows that offer with a
 * button; allowing the offer makes the action the avatar's next turn.
 * Action buttons (Reply, or the offered verb) appear only when that
 * action exists. Clicking anywhere on the card folds or unfolds it and records
 * nothing; clicks on Ignore, Reply, thumbs, or the note stay those actions.
 * The × takes the notice off the screen completely.
 *
 * @param {Object} parameters
 * @param {Object} parameters.message The rendered message (`content`, `ambient`, `isLoading`).
 * @param {string} parameters.assistantId The avatar that noticed.
 * @param {string} [parameters.avatarName] The avatar's name.
 * @param {Function} [parameters.onReply] Called when the person chooses to reply.
 * @param {boolean} [parameters.readOnly] Hide the choices (a shared transcript).
 * @param {boolean} [parameters.defaultCollapsed] Start folded (older voice notices).
 * @param {Object|null} [parameters.storedDecision] What the server holds for this
 *   card, `{rating: 'like'|'dislike'|null, note}`; lights the thumb after a reload.
 * @param {Function} [parameters.onRecorded] Called after a decision is stored, so
 *   the stored preferences can be read back.
 * @param {Function} [parameters.onAllowAction] Called with the message when the
 *   person lets the avatar do what the card offered.
 * @param {Function} [parameters.onInteract] Called with the observation id the
 *   moment the person does anything with the card.
 * @param {Function} [parameters.onDismiss] Called when the person takes the
 *   notice off the screen.
 */
const AmbientNotificationCard = ({
  message,
  assistantId,
  avatarName,
  onReply,
  readOnly = false,
  defaultCollapsed = false,
  storedDecision = null,
  onRecorded,
  onAllowAction,
  onInteract,
  onDismiss,
}) => {
  const ambient = message?.ambient ?? {};
  const [state, setState] = useState('open'); // open | saving | liked | disliked
  const [rating, setRating] = useState(null); // like | dislike | null
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [collapsed, setCollapsed] = useState(Boolean(defaultCollapsed));

  useEffect(() => {
    if (defaultCollapsed) setCollapsed(true);
  }, [defaultCollapsed]);

  // The stored decision is the truth once it arrives; a press that is still
  // saving keeps the thumb it lit until the refresh confirms it.
  const storedRating = storedDecision?.rating ?? null;
  useEffect(() => {
    if (!storedDecision) return;
    setRating(storedRating);
    setState((current) => {
      if (current === 'saving') return current;
      if (storedRating === 'like') return 'liked';
      if (storedRating === 'dislike') return 'disliked';
      return 'open';
    });
  }, [storedDecision, storedRating]);

  const [actionState, setActionState] = useState('idle'); // idle | running | done
  const offer = noticeOffer(message);
  const showOwnerReply = noticeHasSomethingToReplyTo(message);
  const showIgnore = noticeShowsIgnoreAction(message);
  const actionTaken = storedDecision?.actionTaken ?? null;
  const avatarActed = actionTaken === 'avatar_replied' || actionState === 'done';
  const ownerReplied = actionTaken === 'owner_replied';

  const record = async (type, args) => {
    onInteract?.(ambient.observation_id);
    try {
      await recordAmbientPreference(
        assistantId,
        ambientPreferencePayload(message, { type, args })
      );
      onRecorded?.();
      return true;
    } catch (recordError) {
      console.error('Could not record the ambient preference:', recordError);
      toast.error('Could not save that preference.');
      return false;
    }
  };

  const rate = async (nextRating) => {
    const preference = ambientPreferenceForNoticeRating(nextRating);
    if (!preference || state === 'saving') return;
    const previousState = state;
    const previousRating = rating;
    setRating(nextRating);
    setState('saving');
    const recorded = await record(preference.type, preference.args);
    if (!recorded) {
      setRating(previousRating);
      setState(previousState);
      return;
    }
    setState(nextRating === 'dislike' ? 'disliked' : 'liked');
  };

  const submitNote = async () => {
    const text = note.trim();
    if (!text) return;
    setState('saving');
    const recorded = await record('response', text);
    if (recorded) {
      toast.success('Your avatar will remember that.');
      setNote('');
      setShowNote(false);
    }
    setState(rating === 'like' ? 'liked' : rating === 'dislike' ? 'disliked' : 'open');
  };

  const handleReply = () => {
    setShowNote(false);
    // Replying in person is one of the outcomes the next triage learns from.
    // Recorded once; a second press only moves focus again.
    if (!ownerReplied && !avatarActed) {
      record('act', { action: 'owner' });
    }
    onReply?.(message);
  };

  const handleIgnore = async () => {
    if (state === 'saving' || rating === 'dislike') return;
    const previousState = state;
    const previousRating = rating;
    setRating('dislike');
    setState('saving');
    const recorded = await record('ignore', null);
    if (!recorded) {
      setRating(previousRating);
      setState(previousState);
      return;
    }
    setState('disliked');
    toast.success('Your avatar will ignore notices like this.');
    onDismiss?.(message);
  };

  const handleAllowAction = async () => {
    if (!offer || actionState === 'running' || avatarActed) return;
    onInteract?.(ambient.observation_id);
    setShowNote(false);
    setActionState('running');
    try {
      const outcome = await onAllowAction?.(message);
      setActionState(outcome ? 'done' : 'idle');
    } catch (actionError) {
      console.error('Could not let the avatar act:', actionError);
      setActionState('idle');
    }
  };

  const toggleCollapsed = () => {
    setShowNote(false);
    setCollapsed((hidden) => !hidden);
  };

  const handleDismiss = (event) => {
    event.stopPropagation();
    onInteract?.(ambient.observation_id);
    onDismiss?.(message);
  };

  const actionsLocked = state === 'saving';
  const preview = noticePreview(message);
  const heading = `${avatarName ?? 'Your avatar'} noticed something`;
  const collapseLabel = collapsed
    ? EXPAND_NOTICE_TOOLTIP
    : COLLAPSE_NOTICE_TOOLTIP;

  return (
    <div
      className="w-full rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 text-neutral-200 cursor-pointer"
      role="status"
      aria-label={heading}
      onClick={(event) => {
        if (!noticeClickTogglesCard(event)) return;
        toggleCollapsed();
      }}
    >
      <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold uppercase tracking-wide">
        <Eye className="w-4 h-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{heading}</span>
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            toggleCollapsed();
          }}
          title={collapseLabel}
          aria-label={collapseLabel}
          aria-expanded={!collapsed}
          className={ACTION_BUTTON_CLASSES}
        >
          {collapsed ? (
            <ChevronDown className="w-4 h-4" aria-hidden="true" />
          ) : (
            <ChevronUp className="w-4 h-4" aria-hidden="true" />
          )}
        </button>
        {!readOnly && (
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={handleDismiss}
            title={DISMISS_NOTICE_TOOLTIP}
            aria-label={DISMISS_NOTICE_TOOLTIP}
            className={ACTION_BUTTON_CLASSES}
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>
      {collapsed ? (
        preview ? (
          <p className="mt-2 text-xs text-white/50 truncate">{preview}</p>
        ) : null
      ) : message?.isLoading ? (
        <div className="mt-2 flex items-center gap-2 text-white/60 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Writing a heads-up…
        </div>
      ) : (
        <div className="mt-2 whitespace-pre-wrap">{message?.content}</div>
      )}
      {!collapsed && ambient.summary && (
        <p className="mt-2 text-xs text-white/50 italic">{ambient.summary}</p>
      )}
      {!collapsed && ambient.reason && (
        <p className="mt-1 text-xs text-white/40">{ambient.reason}</p>
      )}
      {!collapsed && offer && !message?.isLoading && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-sky-400/20 bg-sky-400/5 px-3 py-2">
          <Sparkles className="w-4 h-4 shrink-0 text-sky-300" aria-hidden="true" />
          <span className="shrink-0 rounded-md bg-sky-400/15 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-sky-200">
            {offer.action}
          </span>
          <span className="min-w-0 flex-1 text-sm text-sky-100">
            {offer.description}
          </span>
          {avatarActed ? (
            <span className="text-xs text-sky-200/80">
              Done. Rate the reply below to teach {avatarName ?? 'your avatar'}.
            </span>
          ) : ownerReplied ? (
            <span className="text-xs text-white/50">You replied instead.</span>
          ) : readOnly ? null : (
            <button
              type="button"
              disabled={actionState === 'running'}
              onClick={handleAllowAction}
              title={offer.description}
              className="px-2 py-1 rounded-md bg-sky-500/20 text-sky-200 text-xs border border-sky-400/30 hover:bg-sky-500/30 disabled:opacity-50 inline-flex items-center gap-1"
            >
              {actionState === 'running' ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                  Working…
                </>
              ) : (
                offer.action
              )}
            </button>
          )}
        </div>
      )}
      {!collapsed && !offer && (avatarActed || ownerReplied) && (
        <p className="mt-2 text-xs text-white/50">
          {avatarActed
            ? `${avatarName ?? 'Your avatar'} acted on this.`
            : 'You replied to this.'}
        </p>
      )}

      {!readOnly && !message?.isLoading && !collapsed && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-0.5">
            {showIgnore && !avatarActed && !ownerReplied && (
              <button
                type="button"
                disabled={actionsLocked || rating === 'dislike'}
                onClick={handleIgnore}
                title={IGNORE_NOTICE_TOOLTIP}
                aria-label={IGNORE_NOTICE_TOOLTIP}
                className="px-2 py-1 mr-1 rounded-md bg-white/5 text-white/70 text-xs border border-white/15 hover:bg-white/10 disabled:opacity-50"
              >
                Ignore
              </button>
            )}
            {showOwnerReply && !avatarActed && !ownerReplied && (
              <button
                type="button"
                onClick={handleReply}
                className="px-2 py-1 mr-1 rounded-md bg-amber-400/15 text-amber-300 text-xs border border-amber-400/30 hover:bg-amber-400/25"
              >
                Reply
              </button>
            )}
            <button
              type="button"
              disabled={actionsLocked}
              onClick={() => rate('like')}
              title={LIKE_NOTICE_TOOLTIP}
              aria-label={LIKE_NOTICE_TOOLTIP}
              aria-pressed={rating === 'like'}
              className={`${ACTION_BUTTON_CLASSES} ${
                rating === 'like' ? 'text-amber-300' : ''
              }`}
            >
              <ThumbsUp className="w-3 h-3" aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={actionsLocked}
              onClick={() => rate('dislike')}
              title={DISLIKE_NOTICE_TOOLTIP}
              aria-label={DISLIKE_NOTICE_TOOLTIP}
              aria-pressed={rating === 'dislike'}
              className={`${ACTION_BUTTON_CLASSES} ${
                rating === 'dislike' ? 'text-amber-300' : ''
              }`}
            >
              <ThumbsDown className="w-3 h-3" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => {
                setShowNote((shown) => {
                  if (!shown && !note && storedDecision?.note) {
                    setNote(storedDecision.note);
                  }
                  return !shown;
                });
              }}
              title="Tell your avatar"
              aria-label="Tell your avatar"
              aria-pressed={showNote}
              className={`${ACTION_BUTTON_CLASSES} ${
                showNote ? 'text-sky-300' : ''
              }`}
            >
              <MessageSquare className="w-3 h-3" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
      {!collapsed && (state === 'liked' || state === 'disliked') && (
        <p className="mt-3 text-xs text-white/50">
          {state === 'liked' ? LIKE_NOTICE_TOOLTIP : DISLIKE_NOTICE_TOOLTIP}.
        </p>
      )}
      {!readOnly && showNote && !collapsed && (
        <div className="mt-2 space-y-1">
          <input
            type="text"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submitNote();
            }}
            placeholder="For example: never tell me about terminal errors"
            className="w-full px-2 py-1.5 bg-black/50 border border-white/10 rounded-md text-neutral-200 text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
          />
          <button
            type="button"
            disabled={state === 'saving' || !note.trim()}
            onClick={submitNote}
            className="px-2 py-1 rounded-md bg-sky-500/20 text-sky-200 text-xs border border-sky-400/30 disabled:opacity-40"
          >
            {state === 'saving' ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
};

export default AmbientNotificationCard;
