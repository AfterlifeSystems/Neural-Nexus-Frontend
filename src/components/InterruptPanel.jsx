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
// A fact review can be folded away and finished later: in this conversation
// after switching between talking and typing, or in avatar settings. The
// choices themselves live on the pending interrupt, not in this component,
// because the panel remounts when the person leaves voice mode.
//
// Every decision here defaults to leaving things alone: the server skips any
// matched document this panel does not explicitly name, so a document retrieved
// by a loose semantic match is never changed just because it was found.

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useMedia } from '../context/MediaContext';
import { useAuth } from '../context/AuthContext';
import { resolveAssistantId } from './utils';
import { interruptHeadingFor } from './interruptHeading';
import {
  DANGER_BUTTON_CLASSES,
  DEFAULT_ACTION_LABELS,
  FactReviewCard,
  matchPercentOf,
  PANEL_CLASSES,
  PRIMARY_BUTTON_CLASSES,
  SECONDARY_BUTTON_CLASSES,
} from './factReview/FactReviewCard';
import {
  collapsedFactReviewSummary,
  createFactReviewDraft,
  factReviewResumeItems,
  patchFactReviewDecision,
  settingsSectionForFactReview,
  skipAllFactReviewItems,
} from './factReview/factReviewDraft';

const FactCorrectionPanel = ({
  interrupt,
  onResume,
  isResuming,
  draft,
  onDraftChange,
}) => {
  const navigate = useNavigate();
  const { activeAvatar } = useAuth();
  const matches = useMemo(() => interrupt.matches ?? [], [interrupt]);
  const actionLabels = {
    ...DEFAULT_ACTION_LABELS,
    ...(interrupt.action_labels ?? {}),
  };
  const factReview = draft ?? createFactReviewDraft(interrupt);
  const decisions = factReview.decisions ?? {};
  const isConfirmingRemovals = Boolean(factReview.isConfirmingRemovals);
  const collapsed = factReview.collapsed !== false;

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
    onDraftChange((current) => patchFactReviewDecision(current, index, patch));
  };

  const buildItems = () => factReviewResumeItems(matches, decisions);

  // The same panel resolves a correction and a researched contradiction, and
  // each needs its own sentence at the top.
  const panelWording = interruptHeadingFor({
    correctionKind: interrupt.correction_kind,
    matchCount: matches.length,
  });
  const foldedSummary = collapsedFactReviewSummary({
    correctionKind: interrupt.correction_kind,
    matchCount: matches.length,
  });

  const handleApply = () => {
    // Removing a document cannot be undone from here, so it is confirmed
    // separately rather than riding along with the edits.
    if (removalCount > 0 && !isConfirmingRemovals) {
      onDraftChange({ collapsed: false, isConfirmingRemovals: true });
      return;
    }
    onResume('apply', buildItems());
  };

  const handleDecideLater = () => {
    onResume('apply', skipAllFactReviewItems(matches));
  };

  const openSettings = () => {
    const assistantId = resolveAssistantId(activeAvatar);
    if (!assistantId) return;
    const section = settingsSectionForFactReview(interrupt.correction_kind);
    navigate(
      `/chat/${encodeURIComponent(assistantId)}?tab=settings&section=${section}`
    );
  };

  const toggleCollapsed = () => {
    onDraftChange({ collapsed: !collapsed, isConfirmingRemovals: false });
  };

  return (
    <div className={PANEL_CLASSES}>
      <div className="flex items-start gap-2">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="text-sm font-semibold text-neutral-200">
            {panelWording.heading}
          </div>
          {collapsed ? (
            <div className="text-xs text-white/50">{foldedSummary}</div>
          ) : (
            <>
              {interrupt.inaccurate_information ? (
                <div className="text-xs text-white/60 italic">
                  You flagged as inaccurate: {interrupt.inaccurate_information}
                </div>
              ) : null}
              <div className="text-xs text-white/50">{panelWording.guidance}</div>
            </>
          )}
        </div>
        <button
          type="button"
          className={`${SECONDARY_BUTTON_CLASSES} px-2 py-2 shrink-0`}
          disabled={isResuming}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Show fact review' : 'Hide fact review'}
          title={collapsed ? 'Show fact review' : 'Hide fact review'}
          onClick={toggleCollapsed}
        >
          {collapsed ? (
            <ChevronDown className="w-4 h-4" aria-hidden="true" />
          ) : (
            <ChevronUp className="w-4 h-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {!collapsed && (
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
      )}

      {isConfirmingRemovals && !collapsed ? (
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
              onClick={() => onDraftChange({ isConfirmingRemovals: false })}
            >
              Go back
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {!collapsed && (
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASSES}
              disabled={isResuming}
              onClick={handleApply}
            >
              ✅ Apply my choices
            </button>
          )}
          <button
            type="button"
            className={collapsed ? PRIMARY_BUTTON_CLASSES : SECONDARY_BUTTON_CLASSES}
            disabled={isResuming}
            onClick={handleDecideLater}
          >
            I'll decide later
          </button>
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASSES}
            disabled={isResuming}
            onClick={openSettings}
          >
            Avatar settings
          </button>
          {!collapsed && (
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASSES}
              disabled={isResuming}
              onClick={() => onResume('cancel')}
            >
              🚫 Cancel correction
            </button>
          )}
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
  const { pendingInterrupt, resumePendingInterrupt, updateFactReviewDraft } =
    useMedia();
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

  // The sequence number changes on every pause, so a second correction —
  // including one raised on the thread and avatar that just answered the first
  // — starts from a newly seeded draft rather than inheriting the previous
  // panel's edits. Choices on THIS pause live on `factReviewDraft`, so leaving
  // voice mode and coming back does not start over.
  const panelKey = pendingInterrupt.sequence;

  // Connecting an account is its own card, and the card lives on the message
  // that paused — MessageList renders the card in place from the message's
  // `connections` (see `ConnectionCardStack`), so nothing is drawn here. The
  // credential is posted to the endpoint that verifies and encrypts it, and
  // only then is the turn resumed, carrying a decision and a record of the
  // outcome; see the note in ConnectAccountCard on why a credential must
  // never travel as an interrupt's resume value.
  if (interrupt.kind === 'connect_account') {
    return null;
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
      draft={pendingInterrupt.factReviewDraft}
      onDraftChange={updateFactReviewDraft}
    />
  );
};

export default InterruptPanel;
