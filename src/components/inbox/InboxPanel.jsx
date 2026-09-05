// src/components/inbox/InboxPanel.jsx
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { resolvePersonalAvatarId } from '../AccountMenu';
import LoadingSpinner from '../LoadingSpinner';
import {
  Bell,
  BellRing,
  Check,
  Inbox,
  Loader2,
  Mail,
  Pencil,
  RefreshCw,
  Send,
  X,
} from 'lucide-react';
import {
  decideInboxItem,
  listInboxItems,
  pollInbox,
} from '../../services/avatarService';
import { refreshInboxCount, requestInboxNotifications } from '../../hooks/useInboxCount';
import { showRequestFailureToast } from '../requestFailureToast';

const DECISION_LABELS = {
  respond: 'Proposed reply',
  notify: 'Needs your attention',
  ignore: 'Ignored',
};

const STATE_LABELS = {
  pending_owner: 'Waiting for you',
  auto_sent: 'Sent automatically',
  sent: 'Sent',
  ignored: 'Ignored',
  resolved: 'Seen',
  failed: 'Failed',
};

const formatWhen = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
};

/**
 * One inbox item: what came in, what the avatar proposes, and the owner's controls.
 */
const InboxItemCard = ({ item, onDecide, isBusy }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedBody, setEditedBody] = useState(item.draft ?? '');
  const [replyText, setReplyText] = useState('');
  const isReply = item.decision === 'respond';
  const isOpen = item.state === 'pending_owner';
  const confidence = item.confidence != null ? Math.round(item.confidence * 100) : null;

  return (
    <article className="bg-black/60 backdrop-blur-lg rounded-2xl border border-white/10 p-5 space-y-3">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-neutral-200 font-medium truncate">{item.subject || '(no subject)'}</p>
          <p className="text-white/60 text-sm truncate">
            {item.sender} · {formatWhen(item.received_at ?? item.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`px-2.5 py-1 rounded-full text-xs border ${
              isReply
                ? 'bg-sky-500/15 border-sky-400/30 text-sky-200'
                : 'bg-amber-400/15 border-amber-400/30 text-amber-200'
            }`}
          >
            {DECISION_LABELS[item.decision] ?? item.decision ?? 'Triaged'}
          </span>
          {!isOpen && (
            <span className="px-2.5 py-1 rounded-full text-xs bg-white/10 border border-white/10 text-white/60">
              {STATE_LABELS[item.state] ?? item.state}
            </span>
          )}
        </div>
      </header>

      {item.reason && <p className="text-white/70 text-sm">{item.reason}</p>}
      {item.needs_owner_action && (
        <p className="text-amber-200 text-xs inline-flex items-center gap-1">
          <BellRing className="w-3.5 h-3.5" aria-hidden="true" />
          Something here needs you in the real world.
        </p>
      )}
      {item.snippet && (
        <blockquote className="text-neutral-300 text-sm whitespace-pre-wrap border-l-2 border-white/10 pl-3 max-h-40 overflow-y-auto">
          {item.snippet}
        </blockquote>
      )}

      {isReply && item.draft && (
        <div className="rounded-xl bg-black/50 border border-white/10 p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-white/60 text-xs">Draft in your voice</p>
            {confidence != null && (
              <p className="text-white/40 text-xs" title={item.confidence_detail?.alignment_reason}>
                Confidence {confidence}%
              </p>
            )}
          </div>
          {isEditing ? (
            <textarea
              value={editedBody}
              onChange={(event) => setEditedBody(event.target.value)}
              rows={6}
              className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50"
            />
          ) : (
            <p className="text-neutral-200 text-sm whitespace-pre-wrap">{item.draft}</p>
          )}
        </div>
      )}

      {isOpen && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {isReply ? (
            <>
              {isEditing ? (
                <button
                  type="button"
                  disabled={isBusy || !editedBody.trim()}
                  onClick={() =>
                    onDecide(item, {
                      type: 'edit',
                      args: { action: 'send_reply', args: { body: editedBody } },
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-200 hover:bg-neutral-100 text-neutral-900 text-sm font-medium disabled:opacity-50"
                >
                  <Send className="w-4 h-4" aria-hidden="true" />
                  Send edited
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => onDecide(item, { type: 'accept', args: null })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-200 hover:bg-neutral-100 text-neutral-900 text-sm font-medium disabled:opacity-50"
                >
                  <Check className="w-4 h-4" aria-hidden="true" />
                  Send as drafted
                </button>
              )}
              <button
                type="button"
                disabled={isBusy}
                onClick={() => setIsEditing((editing) => !editing)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-200 text-sm disabled:opacity-50"
              >
                <Pencil className="w-4 h-4" aria-hidden="true" />
                {isEditing ? 'Cancel edit' : 'Edit'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onDecide(item, { type: 'accept', args: null })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-200 hover:bg-neutral-100 text-neutral-900 text-sm font-medium disabled:opacity-50"
              >
                <Check className="w-4 h-4" aria-hidden="true" />
                Got it
              </button>
              <div className="flex items-center gap-1 flex-grow min-w-[12rem]">
                <input
                  type="text"
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  placeholder="Or reply in your own words…"
                  className="flex-grow px-3 py-1.5 bg-black/50 border border-white/10 rounded-lg text-neutral-200 text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                />
                <button
                  type="button"
                  disabled={isBusy || !replyText.trim()}
                  onClick={() => onDecide(item, { type: 'response', args: replyText })}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-200 disabled:opacity-50"
                  aria-label="Send this reply"
                >
                  <Send className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </>
          )}
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onDecide(item, { type: 'ignore', args: null })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white/60 hover:text-neutral-100 hover:bg-white/10 text-sm disabled:opacity-50"
          >
            <X className="w-4 h-4" aria-hidden="true" />
            Ignore
          </button>
          {isBusy && <Loader2 className="w-4 h-4 animate-spin text-amber-300" aria-hidden="true" />}
        </div>
      )}
    </article>
  );
};

/**
 * The agent inbox: everything the personal avatar triaged on the owner's behalf
 * and is waiting on the owner to decide.
 *
 * Reached from the sidebar's "Avatar Inbox" entry (with the pending badge)
 * and from the Inbox tab on the personal avatar's header. The sidebar
 * selects that avatar first so this panel sits under the same workspace
 * header as its chat. Accept / Edit /
 * Ignore / Reply deliver the same HumanResponse the avatar's chat tools do,
 * so a decision made here or in conversation resumes the same paused triage
 * and teaches the same preferences.
 *
 * @param {Object} [parameters]
 * @param {boolean} [parameters.embedded] When true, drop the full-page padding
 *   so this panel can sit in the avatar header tab.
 */
const InboxPanel = ({ embedded = false }) => {
  const navigate = useNavigate();
  const { userAvatars } = useAuth();
  const [items, setItems] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [view, setView] = useState('open');
  const [isLoading, setIsLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);
  const [busyItemId, setBusyItemId] = useState(null);
  const [notificationPermission, setNotificationPermission] = useState(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  );

  // `/inbox` is a bookmark into the personal avatar's Inbox tab, not a
  // second screen. Without that redirect the page has no workspace header.
  useEffect(() => {
    if (embedded) return undefined;
    let cancelled = false;
    (async () => {
      const personalAvatarId = await resolvePersonalAvatarId(userAvatars);
      if (cancelled) return;
      if (!personalAvatarId) {
        toast.error('You do not have a personal avatar yet.');
        navigate('/avatars', { replace: true });
        return;
      }
      navigate(
        `/chat/${encodeURIComponent(personalAvatarId)}?tab=inbox`,
        { replace: true }
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [embedded, navigate, userAvatars]);

  const refresh = useCallback(async () => {
    try {
      const response = await listInboxItems({ state: view, limit: 100 });
      setItems(response?.items ?? []);
      setPendingCount(response?.pending_count ?? 0);
    } catch (loadError) {
      showRequestFailureToast(loadError, { fallbackMessage: 'Could not load the inbox.' });
    } finally {
      setIsLoading(false);
    }
  }, [view]);

  useEffect(() => {
    if (!embedded) return;
    refresh();
  }, [embedded, refresh]);

  const handleDecide = async (item, decision) => {
    setBusyItemId(item.item_id);
    try {
      const response = await decideInboxItem(item.item_id, decision);
      const updated = response?.item;
      const state = updated?.state;
      toast.success(
        state === 'sent'
          ? 'Reply sent.'
          : state === 'ignored'
            ? 'Ignored — the inbox will remember that.'
            : state === 'failed'
              ? 'The inbox could not complete that.'
              : 'Done.'
      );
      await refresh();
      refreshInboxCount();
    } catch (decideError) {
      showRequestFailureToast(decideError, { fallbackMessage: 'Could not apply that decision.' });
    } finally {
      setBusyItemId(null);
    }
  };

  const handlePoll = async () => {
    setIsPolling(true);
    try {
      const result = await pollInbox();
      toast.success(
        `${result?.polled ?? 0} mailbox${result?.polled === 1 ? '' : 'es'} checked · ${result?.new_items ?? 0} new`
      );
      await refresh();
      refreshInboxCount();
    } catch (pollError) {
      showRequestFailureToast(pollError, { fallbackMessage: 'Could not check the mailboxes.' });
    } finally {
      setIsPolling(false);
    }
  };

  if (!embedded) {
    return <LoadingSpinner fullscreen label="Opening inbox…" />;
  }

  return (
    <div className="flex flex-col flex-grow relative z-10 overflow-y-auto">
      <div className="max-w-3xl mx-auto w-full space-y-4">
        <header className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-neutral-200 inline-flex items-center gap-2">
            <Inbox className="w-6 h-6" aria-hidden="true" />
            Avatar Inbox
            {pendingCount > 0 && (
              <span className="min-w-[1.5rem] h-6 px-2 rounded-full bg-amber-400 text-neutral-900 text-sm font-semibold flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </h1>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex rounded-full bg-white/5 border border-white/10 p-0.5 text-sm">
              {['open', 'all'].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setView(option)}
                  className={`px-3 py-1 rounded-full transition-colors ${
                    view === option ? 'bg-white/15 text-neutral-100' : 'text-white/60 hover:text-neutral-100'
                  }`}
                >
                  {option === 'open' ? 'Waiting' : 'All'}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handlePoll}
              disabled={isPolling}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-200 hover:bg-neutral-100 text-neutral-900 text-sm font-medium disabled:opacity-50"
            >
              {isPolling ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
              )}
              Check now
            </button>
          </div>
        </header>

        {notificationPermission === 'default' && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-amber-400/10 border border-amber-400/30 px-4 py-3">
            <p className="text-amber-100 text-sm inline-flex items-center gap-2">
              <Bell className="w-4 h-4" aria-hidden="true" />
              Get a desktop notification when something needs you.
            </p>
            <button
              type="button"
              onClick={async () => setNotificationPermission(await requestInboxNotifications())}
              className="px-3 py-1.5 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 text-amber-200 text-sm border border-amber-400/30"
            >
              Turn on
            </button>
          </div>
        )}

        <p className="text-white/50 text-sm inline-flex items-center gap-2">
          <Mail className="w-4 h-4" aria-hidden="true" />
          Your avatar reads new mail in your connected accounts, replies on its own when it is
          confident it knows how you would, and brings the rest here. Every decision you make
          teaches it.
        </p>

        {isLoading ? (
          <p className="text-white/50 text-sm">Loading…</p>
        ) : items.length === 0 ? (
          <div className="bg-black/60 backdrop-blur-lg rounded-2xl border border-white/10 p-8 text-center text-white/50">
            {view === 'open' ? 'Nothing is waiting for you.' : 'No items yet.'}
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <InboxItemCard
                key={item.item_id}
                item={item}
                onDecide={handleDecide}
                isBusy={busyItemId === item.item_id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default InboxPanel;
