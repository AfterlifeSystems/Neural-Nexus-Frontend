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
import { interruptHeadingFor } from './interruptHeading';
import {
  ACTION_ORDER,
  DANGER_BUTTON_CLASSES,
  DEFAULT_ACTION_LABELS,
  FactReviewCard,
  matchPercentOf,
  PANEL_CLASSES,
  PRIMARY_BUTTON_CLASSES,
  SECONDARY_BUTTON_CLASSES,
} from './factReview/FactReviewCard';

// The three things that can be done with one matched document. The order is the
// order they are offered in; `skip` is last because it is the do-nothing choice.
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

  // The same panel resolves a correction and a researched contradiction, and
  // each needs its own sentence at the top.
  const panelWording = interruptHeadingFor({
    correctionKind: interrupt.correction_kind,
    matchCount: matches.length,
  });

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
        <div className="text-sm font-semibold text-neutral-200">
          {panelWording.heading}
        </div>
        {interrupt.inaccurate_information ? (
          <div className="text-xs text-white/60 italic">
            You flagged as inaccurate: {interrupt.inaccurate_information}
          </div>
        ) : null}
        <div className="text-xs text-white/50">{panelWording.guidance}</div>
      </div>

      <div className="space-y-3">
        {orderedMatches.map((match) => (
          <FactReviewCard
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
      <div className="text-sm font-semibold text-neutral-200">
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
