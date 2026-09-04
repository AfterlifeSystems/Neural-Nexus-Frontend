// src/components/AmbientNotificationCard.jsx
import React, { useState } from 'react';
import { Eye, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { recordAmbientPreference } from '../services/avatarService';

/**
 * The card the avatar posts into the chat when ambient vision saw something
 * the person should hear about.
 *
 * The message itself is an ordinary reply from the avatar; what makes it a
 * card is the triage record the API attaches to the reply
 * (`response_metadata.ambient` with `decision: "notify"`). The card offers the
 * Agent Inbox choices — dismiss or reply — and either one teaches the avatar:
 * a dismissal, or a note typed into the card, is recorded as a preference the
 * next triage of a similar scene reads as precedent. A reply is simply the
 * person's next message, so the Reply button only moves focus to the composer
 * (in voice mode the person just speaks).
 *
 * @param {Object} parameters
 * @param {Object} parameters.message The rendered message (`content`, `ambient`, `isLoading`).
 * @param {string} parameters.assistantId The avatar that noticed.
 * @param {string} [parameters.avatarName] The avatar's name.
 * @param {Function} [parameters.onReply] Called when the person chooses to reply.
 * @param {boolean} [parameters.readOnly] Hide the choices (a shared transcript).
 */
const AmbientNotificationCard = ({
  message,
  assistantId,
  avatarName,
  onReply,
  readOnly = false,
}) => {
  const ambient = message?.ambient ?? {};
  const [state, setState] = useState('open'); // open | dismissing | dismissed | noting
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);

  const record = async (type, args) => {
    try {
      await recordAmbientPreference(assistantId, {
        observationId: ambient.observation_id,
        observationKind: ambient.observation_kind,
        summary: ambient.summary,
        type,
        args,
      });
      return true;
    } catch (recordError) {
      console.error('Could not record the ambient preference:', recordError);
      toast.error('Could not save that preference.');
      return false;
    }
  };

  const dismiss = async () => {
    setState('dismissing');
    const recorded = await record('ignore', null);
    setState(recorded ? 'dismissed' : 'open');
  };

  const submitNote = async () => {
    const text = note.trim();
    if (!text) return;
    setState('noting');
    const recorded = await record('response', text);
    if (recorded) {
      toast.success('Your avatar will remember that.');
      setNote('');
      setShowNote(false);
    }
    setState('open');
  };

  return (
    <div
      className="w-full rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 text-neutral-200"
      role="status"
      aria-label={`${avatarName ?? 'Your avatar'} noticed something`}
    >
      <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold uppercase tracking-wide">
        <Eye className="w-4 h-4" />
        <span>{avatarName ?? 'Your avatar'} noticed something</span>
      </div>
      {message?.isLoading ? (
        <div className="mt-2 flex items-center gap-2 text-white/60 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Writing a heads-up…
        </div>
      ) : (
        <div className="mt-2 whitespace-pre-wrap">{message?.content}</div>
      )}
      {ambient.summary && (
        <p className="mt-2 text-xs text-white/50 italic">{ambient.summary}</p>
      )}

      {!readOnly && !message?.isLoading && state !== 'dismissed' && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onReply?.(message)}
            className="px-2 py-1 rounded-md bg-amber-400/15 text-amber-300 text-xs border border-amber-400/30 hover:bg-amber-400/25"
          >
            Reply
          </button>
          <button
            type="button"
            disabled={state === 'dismissing'}
            onClick={dismiss}
            className="px-2 py-1 rounded-md bg-white/5 text-white/70 text-xs border border-white/10 hover:bg-white/10 disabled:opacity-50"
          >
            {state === 'dismissing' ? 'Dismissing…' : 'Dismiss'}
          </button>
          <button
            type="button"
            onClick={() => setShowNote((shown) => !shown)}
            className="px-2 py-1 rounded-md text-white/60 text-xs hover:text-white/90"
          >
            Tell your avatar…
          </button>
        </div>
      )}
      {state === 'dismissed' && (
        <p className="mt-3 text-xs text-white/50">
          Dismissed. Your avatar will not bring this kind of thing up as readily.
        </p>
      )}
      {!readOnly && showNote && state !== 'dismissed' && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submitNote();
            }}
            placeholder="For example: never tell me about terminal errors"
            className="flex-1 min-w-0 px-2 py-1.5 bg-black/50 border border-white/10 rounded-md text-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50"
          />
          <button
            type="button"
            disabled={state === 'noting' || !note.trim()}
            onClick={submitNote}
            className="px-2 py-1 rounded-md bg-amber-400/15 text-amber-300 text-xs border border-amber-400/30 disabled:opacity-50"
          >
            {state === 'noting' ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
};

export default AmbientNotificationCard;
