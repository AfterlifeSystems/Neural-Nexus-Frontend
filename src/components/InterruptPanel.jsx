// src/components/InterruptPanel.jsx
//
// The panel a paused turn puts in front of the user.
//
// The graph stops and asks a question whenever it is about to change something
// it should not change unilaterally — rewriting or deleting the documents that
// make up an avatar's identity, or connecting an outside data server. The run
// stays parked on the server until an answer is posted back, so this panel is
// the only thing that lets such a conversation continue.
//
// Every decision here defaults to leaving things alone: the server skips any
// matched document this panel does not explicitly name, so a document retrieved
// by a loose semantic match is never changed just because it was found.

import React, { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import ConnectAccountCard from './ConnectAccountCard';
import { useMedia } from '../context/MediaContext';
import { useAuth } from '../context/AuthContext';
import { resolveAssistantId } from './utils';

// The three things that can be done with one matched document. The order is the
// order they are offered in; `skip` is last because it is the do-nothing choice.
const ACTION_ORDER = ['accept', 'remove', 'skip'];

// Used only when the payload omits `action_labels`. The server ships its own
// wording, and that wording wins, so these two never disagree in front of a user.
const DEFAULT_ACTION_LABELS = {
  accept: 'Accept Edit',
  remove: 'Remove the Document',
  skip: 'Leave the document unchanged',
};

const PANEL_CLASSES =
  'self-start w-full bg-white/5 backdrop-blur-lg rounded-2xl border border-white/20 p-4 sm:p-6 space-y-4';
const PRIMARY_BUTTON_CLASSES =
  'px-4 py-2 rounded border border-gray-700 bg-teal-600 text-white hover:bg-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:opacity-50 disabled:cursor-not-allowed';
const SECONDARY_BUTTON_CLASSES =
  'px-4 py-2 rounded border border-gray-700 bg-black/35 text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:opacity-50 disabled:cursor-not-allowed';
const DANGER_BUTTON_CLASSES =
  'px-4 py-2 rounded border border-red-500/60 bg-red-600/80 text-white hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-50 disabled:cursor-not-allowed';
const TEXTAREA_CLASSES =
  'w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400';

/**
 * How strongly a stored document matched what the user called inaccurate.
 *
 * The server sends a rounded percentage, but older payloads carry only the raw
 * score, so the percentage is derived when it is missing. Null means the payload
 * offered neither and nothing should be claimed about the strength of the match.
 *
 * @param {Object} match One entry from the interrupt's `matches`.
 * @returns {number|null} A percentage, or null when unknown.
 */
function matchPercentOf(match) {
  if (typeof match?.match_percent === 'number') {
    return Math.round(match.match_percent);
  }
  if (typeof match?.score === 'number') {
    return Math.round(match.score * 100);
  }
  return null;
}

/**
 * Describe what kind of stored text a match points at.
 *
 * The distinction matters to the person deciding: an atomic fact is rewritten or
 * deleted whole, while a sentence inside a longer transcript is edited in place
 * and the rest of that document is untouched.
 *
 * @param {Object} match One entry from the interrupt's `matches`.
 * @returns {string} A phrase for the caption.
 */
function describeMatchKind(match) {
  return match?.kind === 'sentence'
    ? 'sentence in quote/long text'
    : 'fact';
}

/**
 * One matched document, with the decision to be made about it.
 */
const MatchCard = ({ match, decision, actionLabels, onChange, isResuming }) => {
  const percent = matchPercentOf(match);
  const namespacePath = Array.isArray(match.namespace)
    ? match.namespace.join('/')
    : '';

  const recommendationHint = () => {
    if (match.recommended_action === 'remove') {
      return 'I recommend removing this document.';
    }
    if (match.recommended_action === 'accept') {
      return null; // The suggested edit below is the recommendation.
    }
    return 'I recommend leaving this document unchanged.';
  };

  const hint = recommendationHint();

  return (
    <div className="bg-black/25 rounded-xl border border-white/10 p-4 space-y-3">
      <div className="text-xs text-white/50 space-y-1">
        <div>
          📄 {namespacePath}
          {namespacePath ? ' · ' : ''}
          {describeMatchKind(match)}
          {percent !== null ? ` · match ${percent}%` : ''}
        </div>
        <div className="font-mono break-all">
          document_id: {match.document_id ?? match.key ?? 'unknown'}
        </div>
      </div>

      <div className="text-sm text-white">
        <span className="font-semibold">Current document fact content: </span>
        <span className="text-white/90">{match.current_fact_content}</span>
      </div>

      {match.current_fact_context ? (
        <div className="text-xs text-white/60">
          Current document fact context: {match.current_fact_context}
        </div>
      ) : null}

      {hint ? (
        <div className="text-xs text-teal-200/90">💡 {hint}</div>
      ) : null}

      <fieldset disabled={isResuming}>
        <legend className="text-xs text-white/60 mb-2">
          What should I do with this?
        </legend>
        <div className="flex flex-wrap gap-2">
          {ACTION_ORDER.map((action) => {
            const isSelected = decision.action === action;
            return (
              <label
                key={action}
                className={`cursor-pointer text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  isSelected
                    ? 'bg-teal-600 border-teal-400 text-white'
                    : 'bg-black/35 border-gray-700 text-white/70 hover:bg-white/10'
                } ${isResuming ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <input
                  type="radio"
                  className="sr-only"
                  name={`interrupt-action-${match.index}`}
                  value={action}
                  checked={isSelected}
                  onChange={() => onChange({ action })}
                />
                {actionLabels[action]}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-2">
        <label className="block text-xs text-white/60">
          Suggested edit fact content (applied when you choose “
          {actionLabels.accept}”)
          <textarea
            className={`${TEXTAREA_CLASSES} mt-1`}
            rows={3}
            value={decision.correctedText}
            disabled={isResuming}
            onChange={(changeEvent) =>
              onChange({ correctedText: changeEvent.target.value })
            }
          />
        </label>
        <label className="block text-xs text-white/60">
          Suggested edit fact context (applied when you choose “
          {actionLabels.accept}”)
          <textarea
            className={`${TEXTAREA_CLASSES} mt-1`}
            rows={2}
            value={decision.correctedContext}
            disabled={isResuming}
            onChange={(changeEvent) =>
              onChange({ correctedContext: changeEvent.target.value })
            }
          />
        </label>
      </div>
    </div>
  );
};

/**
 * The per-document panel for a paused fact correction.
 *
 * @param {Object} props
 * @param {Object} props.interrupt The interrupt payload.
 * @param {Function} props.onResume Called with (decision, items).
 * @param {boolean} props.isResuming Whether a decision is already in flight.
 */
const FactCorrectionPanel = ({ interrupt, onResume, isResuming }) => {
  const matches = useMemo(() => interrupt.matches ?? [], [interrupt]);
  const actionLabels = {
    ...DEFAULT_ACTION_LABELS,
    ...(interrupt.action_labels ?? {}),
  };

  const [decisions, setDecisions] = useState(() => {
    const seeded = {};
    for (const match of matches) {
      // An unrecognized recommendation falls back to the do-nothing choice
      // rather than to whatever happens to be first in the list.
      const recommended = ACTION_ORDER.includes(match.recommended_action)
        ? match.recommended_action
        : 'skip';
      seeded[match.index] = {
        action: recommended,
        correctedText: match.suggested_edit_fact_content ?? '',
        correctedContext: match.suggested_edit_fact_context ?? '',
      };
    }
    return seeded;
  });

  const [isConfirmingRemovals, setIsConfirmingRemovals] = useState(false);

  // Strongest match first, so the document most likely to be the one the user
  // meant is the one they read first. Sorting a COPY is deliberate: the server
  // keys every decision on `index`, not on position, so the payload order must
  // survive untouched.
  const orderedMatches = useMemo(
    () =>
      [...matches].sort(
        (left, right) =>
          (matchPercentOf(right) ?? -1) - (matchPercentOf(left) ?? -1)
      ),
    [matches]
  );

  const removalCount = matches.filter(
    (match) => decisions[match.index]?.action === 'remove'
  ).length;

  const updateDecision = (index, patch) => {
    setDecisions((previousDecisions) => ({
      ...previousDecisions,
      [index]: { ...previousDecisions[index], ...patch },
    }));
    // A changed choice invalidates a confirmation the user was part-way through.
    setIsConfirmingRemovals(false);
  };

  const buildItems = () =>
    matches.map((match) => ({
      index: match.index,
      action: decisions[match.index]?.action ?? 'skip',
      corrected_text: decisions[match.index]?.correctedText ?? '',
      correction_context: decisions[match.index]?.correctedContext ?? '',
    }));

  const handleApply = () => {
    // Removing a document cannot be undone from here, so it is confirmed
    // separately rather than riding along with the edits.
    if (removalCount > 0 && !isConfirmingRemovals) {
      setIsConfirmingRemovals(true);
      return;
    }
    onResume('apply', buildItems());
  };

  return (
    <div className={PANEL_CLASSES}>
      <div className="space-y-1">
        <div className="text-sm font-semibold text-white">
          ✏️ I found {matches.length} stored item
          {matches.length === 1 ? '' : 's'} that might match — choose what to do
          with each.
        </div>
        {interrupt.inaccurate_information ? (
          <div className="text-xs text-white/60 italic">
            You flagged as inaccurate: {interrupt.inaccurate_information}
          </div>
        ) : null}
        <div className="text-xs text-white/50">
          Each item is pre-selected to my recommendation; you can change any of
          them. Anything I recommend leaving unchanged stays exactly as-is unless
          you pick another action.
        </div>
      </div>

      <div className="space-y-3">
        {orderedMatches.map((match) => (
          <MatchCard
            key={match.index}
            match={match}
            decision={
              decisions[match.index] ?? {
                action: 'skip',
                correctedText: '',
                correctedContext: '',
              }
            }
            actionLabels={actionLabels}
            isResuming={isResuming}
            onChange={(patch) => updateDecision(match.index, patch)}
          />
        ))}
      </div>

      {isConfirmingRemovals ? (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 space-y-3">
          <div className="flex items-start gap-2 text-sm text-red-100">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              {removalCount} document{removalCount === 1 ? '' : 's'} will be
              permanently removed. This cannot be undone.
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={DANGER_BUTTON_CLASSES}
              disabled={isResuming}
              onClick={handleApply}
            >
              Confirm
            </button>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASSES}
              disabled={isResuming}
              onClick={() => setIsConfirmingRemovals(false)}
            >
              Go back
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASSES}
            disabled={isResuming}
            onClick={handleApply}
          >
            ✅ Apply my choices
          </button>
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASSES}
            disabled={isResuming}
            onClick={() => onResume('cancel')}
          >
            🚫 Cancel correction
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * The consent panel for connecting an outside data server to this avatar.
 *
 * @param {Object} props
 * @param {Object} props.interrupt The interrupt payload.
 * @param {Function} props.onResume Called with (decision).
 * @param {boolean} props.isResuming Whether a decision is already in flight.
 */
const DataServerConsentPanel = ({ interrupt, onResume, isResuming }) => {
  const server = interrupt.server ?? {};
  const allowedRoots = server.allowed_roots ?? [];

  return (
    <div className={PANEL_CLASSES}>
      <div className="text-sm font-semibold text-white">
        {interrupt.prompt ??
          'A data server is available — connect it to this avatar for data analysis?'}
      </div>
      <div className="text-xs text-white/60 space-y-1">
        <div>Server: {server.server_name ?? 'unknown'}</div>
        {server.url ? (
          <div className="font-mono break-all">Tool endpoint: {server.url}</div>
        ) : null}
        {allowedRoots.length > 0 ? (
          <div>Allowed data roots: {allowedRoots.join(', ')}</div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASSES}
          disabled={isResuming}
          onClick={() => onResume('apply')}
        >
          ✅ Connect for data analysis
        </button>
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASSES}
          disabled={isResuming}
          onClick={() => onResume('cancel')}
        >
          🚫 Not now
        </button>
      </div>
    </div>
  );
};

/**
 * Render whatever question the currently paused turn is asking, if any.
 *
 * Mounted in the message list so the panel appears exactly where the assistant's
 * next message would have been.
 */
const InterruptPanel = () => {
  const { pendingInterrupt, resumePendingInterrupt } = useMedia();
  const { activeAvatar } = useAuth();
  const [isResuming, setIsResuming] = useState(false);

  if (!pendingInterrupt) {
    return null;
  }

  // A turn keeps running after the user navigates away, so a pause can land
  // while a different avatar is on screen. The question belongs to the
  // conversation it was asked in and is shown only there.
  if (pendingInterrupt.assistantId !== resolveAssistantId(activeAvatar)) {
    return null;
  }

  const handleResume = async (decision, items) => {
    setIsResuming(true);
    try {
      await resumePendingInterrupt(decision, items);
    } finally {
      setIsResuming(false);
    }
  };

  const interrupt = pendingInterrupt.interrupt ?? {};

  // Remounting on a new pause is what resets the choices a panel holds. The
  // sequence number changes on every pause, so a second correction — including
  // one raised on the thread and avatar that just answered the first — starts
  // from its own recommendations rather than inheriting the previous panel's
  // edits.
  const panelKey = pendingInterrupt.sequence;

  // Connecting an account is its own card: the credential is posted to the
  // endpoint that verifies and encrypts it, and only then is the turn resumed,
  // carrying a decision and nothing else. See the note in ConnectAccountCard on
  // why a credential must never travel as an interrupt's resume value.
  if (interrupt.kind === 'connect_account') {
    return (
      <ConnectAccountCard
        key={panelKey}
        interrupt={interrupt}
        onDecision={handleResume}
      />
    );
  }

  const PanelForKind =
    interrupt.kind === 'mcp_connect_consent'
      ? DataServerConsentPanel
      : FactCorrectionPanel;

  return (
    <PanelForKind
      key={panelKey}
      interrupt={interrupt}
      onResume={handleResume}
      isResuming={isResuming}
    />
  );
};

export default InterruptPanel;
