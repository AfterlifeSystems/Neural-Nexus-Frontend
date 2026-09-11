// src/components/research/ResearchPanel.jsx
//
// Deep research with web-based fact verification, from the Upload section of
// avatar settings. Pressing Research scopes the subject against what the
// avatar already knows, searches the web topic by topic, reads the sources,
// and checks every claim against the other sources and against the avatar's
// own facts.
//
// What the sources agree on is added to what the avatar knows as soon as the
// job finishes — those rows appear in "What <name> has learned", where they
// stay searchable and editable. Only the contradictions arrive here, because
// only a contradiction needs a person to choose a version.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  AlertTriangle,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Search,
  Telescope,
} from 'lucide-react';

import {
  cancelResearchJob,
  listResearchProposals,
  resolveResearchProposals,
  startAvatarDeepResearch,
  streamResearchProgress,
} from '../../services/avatarService';
import {
  describeResearchOutcome,
  ACQUISITION_STAGES,
  describeResearchStage,
} from './researchProgress';
import { notifyAvatarPortraitChanged } from '../../services/avatarPortraitEvents';
import { FactReviewCard } from '../factReview/FactReviewCard';
import {
  RESEARCH_ACTION_LABELS,
  buildProposalResolutions,
  researchProposalAsCard,
} from '../factReview/researchProposalCard';
import {
  activeResearchJobIdFor,
  forgetResearchJob,
  readRememberedResearchJob,
  rememberResearchJob,
  subscribeResearchJobs,
} from './researchJobMemory';

/**
 * Deep research and the review of what the sources contradicted.
 *
 * @param {Object} props
 * @param {string} props.assistantId The avatar to research.
 * @param {string} [props.avatarName] The avatar's name, for the copy.
 * @param {Function} [props.onVoiceAcquired] Called when the research has found a
 *   recording and made it this avatar's reference voice, so the voice panel
 *   re-reads what the avatar has collected.
 * @param {Function} [props.onFactsApplied] Called when research has written
 *   new facts, so the learned-facts card re-reads the list.
 */
const ResearchPanel = ({
  assistantId,
  avatarName,
  onFactsApplied,
  onVoiceAcquired,
}) => {
  const [researchHint, setResearchHint] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  // The running job AND the avatar it belongs to. Holding the bare id let a
  // job started on one avatar survive a switch to another: the panel followed
  // the old avatar's job under the new avatar's name, and — because following
  // sets the running flag — refused to start research on the new avatar at all.
  const [job, setJob] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  // Acquiring the portrait and the voice runs alongside fact verification, so
  // its frames interleave with the research frames on the one stream. Keeping
  // it on its own line stops the two tracks from overwriting each other.
  const [acquisitionMessage, setAcquisitionMessage] = useState('');
  const [proposals, setProposals] = useState([]);
  const [decisions, setDecisions] = useState({});
  const [isLoadingProposals, setIsLoadingProposals] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const factsAppliedRef = useRef(onFactsApplied);
  factsAppliedRef.current = onFactsApplied;
  const voiceAcquiredRef = useRef(onVoiceAcquired);
  voiceAcquiredRef.current = onVoiceAcquired;

  const loadProposals = useCallback(async () => {
    if (!assistantId) return;
    setIsLoadingProposals(true);
    try {
      const pending = await listResearchProposals(assistantId);
      setProposals(pending);
      // Every contradiction starts on "decide later": accepting one is the
      // owner's choice, never a default.
      setDecisions({});
    } catch (loadError) {
      console.error('Loading researched facts failed:', loadError);
    } finally {
      setIsLoadingProposals(false);
    }
  }, [assistantId]);

  useEffect(() => {
    loadProposals();
  }, [loadProposals]);

  // A job started after this panel mounted (create-from-photo ingest, then
  // research) is remembered in the same tab. Pick it up so the progress
  // stream starts without a reload.
  useEffect(() => {
    return subscribeResearchJobs((changedAssistantId) => {
      if (changedAssistantId !== assistantId) return;
      const remembered = readRememberedResearchJob(assistantId);
      if (!remembered) return;
      setJob((current) => {
        if (current?.id === remembered && current.assistantId === assistantId) {
          return current;
        }
        return { assistantId, id: remembered };
      });
    });
  }, [assistantId]);

  // Follow the running job — the one started here, or one still running from
  // before the page reloaded — and reload the review list when it finishes.
  useEffect(() => {
    const activeJobId = activeResearchJobIdFor({
      job,
      assistantId,
      rememberedJobId: readRememberedResearchJob(assistantId),
    });
    if (!activeJobId) {
      // No job for THIS avatar. Say so plainly rather than leaving the running
      // flag set by whichever avatar was open before.
      setIsRunning(false);
      setProgressMessage('');
      setAcquisitionMessage('');
      return undefined;
    }
    const controller = new AbortController();
    setIsRunning(true);
    streamResearchProgress(
      activeJobId,
      (event) => {
        if (event.type === 'research_done') {
          setIsRunning(false);
          setJob(null);
          forgetResearchJob(assistantId);
          setProgressMessage(describeResearchOutcome(event));
          if (event.result?.applied) factsAppliedRef.current?.();
          loadProposals();
          return;
        }
        if (ACQUISITION_STAGES.has(event?.stage)) {
          setAcquisitionMessage(describeResearchStage(event));
          // A portrait or a reference clip that just landed is held by every
          // screen showing this avatar; tell them to re-read it rather than
          // waiting for a reload.
          if (event.stage === 'portrait_stored') {
            notifyAvatarPortraitChanged(assistantId);
          }
          if (event.stage === 'voice_stored') {
            voiceAcquiredRef.current?.();
          }
          return;
        }
        setProgressMessage(describeResearchStage(event));
      },
      controller.signal
    ).catch((streamError) => {
      if (controller.signal.aborted) return;
      console.error('Research progress stream failed:', streamError);
      setIsRunning(false);
      forgetResearchJob(assistantId);
      setProgressMessage(
        'Lost the research progress stream; the results appear here when the research finishes.'
      );
    });
    return () => controller.abort();
  }, [assistantId, job, loadProposals]);

  const handleStartResearch = async () => {
    if (isStarting || isRunning) return;
    setIsStarting(true);
    try {
      const started = await startAvatarDeepResearch(assistantId, {
        researchHint: researchHint.trim() || undefined,
      });
      if (started?.job_id) {
        rememberResearchJob(assistantId, started.job_id);
        setProgressMessage('Research started.');
        setJob({ assistantId, id: started.job_id });
      }
    } catch (researchError) {
      toast.error(researchError?.message || 'Could not start the research.');
    } finally {
      setIsStarting(false);
    }
  };

  const handleCancelResearch = async () => {
    const activeJobId = activeResearchJobIdFor({
      job,
      assistantId,
      rememberedJobId: readRememberedResearchJob(assistantId),
    });
    if (!activeJobId) return;
    try {
      await cancelResearchJob(activeJobId);
      setProgressMessage('Stopping the research…');
    } catch (cancelError) {
      toast.error(cancelError?.message || 'Could not stop the research.');
    }
  };

  const applyDecisions = async () => {
    if (proposals.length === 0) return;
    setIsApplying(true);
    try {
      const result = await resolveResearchProposals(
        assistantId,
        buildProposalResolutions(proposals, decisions)
      );
      toast.success(
        `${result.accepted + result.edited} facts added, ${result.ignored} ignored.`
      );
      if (result.accepted + result.edited > 0) factsAppliedRef.current?.();
      await loadProposals();
    } catch (applyError) {
      console.error('Applying research decisions failed:', applyError);
      toast.error(applyError?.message || 'Could not apply the decisions.');
    } finally {
      setIsApplying(false);
    }
  };

  const proposalCards = useMemo(
    () => proposals.map((proposal, index) => researchProposalAsCard(index, proposal)),
    [proposals]
  );

  // A fresh decision for one card: the researched wording is carried into the
  // editable window, so the owner reads and edits the version the research
  // actually proposes instead of an empty box. The action still starts on
  // "decide later" — filling the text in is not choosing to accept it.
  const initialDecisionFor = (card) => ({
    action: 'skip',
    correctedText: card.suggested_edit_fact_content ?? '',
    correctedContext: card.suggested_edit_fact_context ?? '',
  });

  const setEveryDecision = (action) => {
    setDecisions(
      Object.fromEntries(
        proposalCards.map((card) => [
          card.index,
          { ...initialDecisionFor(card), action },
        ])
      )
    );
  };

  return (
    <div className="mt-6 rounded-xl border border-white/10 bg-black/40 p-4">
      <h3 className="text-base font-semibold text-neutral-200 flex items-center gap-2">
        <Telescope size={18} className="text-amber-300" aria-hidden="true" />
        Deep research & fact verification
      </h3>
      <p className="text-sm text-white/60 mt-1">
        Research {avatarName ? `${avatarName}'s` : 'this avatar’s'} subject on
        the web, and check every claim against the other sources and against
        what this avatar already knows. Facts the sources agree on are added
        straight away; anything the sources contradict waits for you here.
      </p>
      <div className="flex flex-col sm:flex-row gap-2 mt-3">
        <input
          type="text"
          value={researchHint}
          onChange={(event) => setResearchHint(event.target.value)}
          placeholder="Optional: narrow the subject — “the sculptor, not the footballer”"
          className="w-full min-w-0 sm:flex-1 px-4 py-3 bg-black/50 border border-white/10 rounded-lg text-neutral-200 placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
        />
        <button
          type="button"
          onClick={handleStartResearch}
          disabled={isStarting || isRunning}
          className="px-4 py-3 bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 font-semibold rounded-lg transition-all duration-300 flex items-center justify-center gap-2 border border-amber-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isStarting || isRunning ? (
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
          ) : (
            <Search size={18} aria-hidden="true" />
          )}
          {isRunning ? 'Researching…' : 'Research & verify facts'}
        </button>
        {isRunning && (
          <button
            type="button"
            onClick={handleCancelResearch}
            className="px-4 py-3 rounded-lg border border-white/20 text-white/80 hover:bg-white/10 transition-colors"
          >
            Stop
          </button>
        )}
      </div>
      {progressMessage && (
        <p className="text-sm text-white/70 mt-3 flex items-start gap-2">
          {isRunning && (
            <RefreshCw
              className="w-4 h-4 mt-0.5 animate-spin shrink-0"
              aria-hidden="true"
            />
          )}
          <span>{progressMessage}</span>
        </p>
      )}
      {acquisitionMessage && (
        <p className="text-sm text-white/60 mt-2 flex items-start gap-2">
          <ImageIcon className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          <span>{acquisitionMessage}</span>
        </p>
      )}

      {isLoadingProposals && proposals.length === 0 && (
        <p className="text-sm text-white/50 mt-3">Loading researched facts…</p>
      )}
      {proposals.length > 0 && (
        <div className="mt-4">
          <p className="text-sm text-amber-200/90 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" aria-hidden="true" />
            {proposals.length}{' '}
            {proposals.length === 1 ? 'fact needs' : 'facts need'} your
            decision: the sources disagree.
          </p>
          <div className="flex flex-wrap items-center gap-2 my-3 text-xs">
            <button
              type="button"
              onClick={() => setEveryDecision('accept')}
              className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-neutral-200"
            >
              Accept all
            </button>
            <button
              type="button"
              onClick={() => setEveryDecision('remove')}
              className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-neutral-200"
            >
              Discard all
            </button>
            <button
              type="button"
              onClick={loadProposals}
              className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-neutral-200 flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" aria-hidden="true" /> Refresh
            </button>
          </div>
          {/* The same card the conversation shows when the avatar pauses to
              have a fact settled, so this control is learned once. */}
          <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
            {proposalCards.map((card) => (
              <FactReviewCard
                key={card.key}
                match={card}
                decision={decisions[card.index] ?? initialDecisionFor(card)}
                actionLabels={RESEARCH_ACTION_LABELS}
                onChange={(next) =>
                  setDecisions((previous) => ({ ...previous, [card.index]: next }))
                }
                isResuming={isApplying}
              />
            ))}
          </div>
          <div className="flex items-center gap-3 mt-3">
            <button
              type="button"
              onClick={applyDecisions}
              disabled={isApplying}
              className="ml-auto px-4 py-2 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 border border-amber-400/30 disabled:opacity-50 flex items-center gap-2 transition-colors"
            >
              {isApplying ? 'Applying…' : 'Apply decisions'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResearchPanel;
