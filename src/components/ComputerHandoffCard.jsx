import React, { useState } from 'react';
import { Check, Monitor, SkipForward } from 'lucide-react';
import AgentComputerTakeover from './AgentComputerTakeover';
import {
  COMPUTER_DECISION_DONE,
  COMPUTER_DECISION_SKIP,
  computerCardStage,
  computerPreviewSource,
  settledComputerCard,
} from '../services/computerHandoff';

/**
 * In-chat Computer card: Action needed with a live preview, then Done.
 *
 * Take over is a local fullscreen view and does not resume the paused turn.
 * Only I'm done or Skip resume the graph. Credentials never ride the resume.
 */
const ComputerHandoffCard = ({
  interrupt,
  card,
  onDecision,
  className = 'self-start w-full max-w-[85%]',
  compact = false,
  readOnly = false,
}) => {
  const payload = interrupt ?? card ?? {};
  const [takeoverOpen, setTakeoverOpen] = useState(false);
  const [resultCard, setResultCard] = useState(null);
  const stage = computerCardStage(resultCard ?? payload);
  const preview = computerPreviewSource(payload);
  const task =
    payload.task ||
    'Sign in on the vendor page (including any two-factor step), then hand back';
  const waiting = Array.isArray(payload.providers_waiting)
    ? payload.providers_waiting
    : [];

  const finish = (decision) => {
    const settled = settledComputerCard(payload, decision);
    setResultCard(settled);
    setTakeoverOpen(false);
    onDecision?.(decision, null, settled);
  };

  if (stage === 'done' || stage === 'skipped') {
    return (
      <div
        className={`${className} bg-black/60 backdrop-blur-lg rounded-2xl border border-white/10 ${
          compact ? 'p-2.5' : 'p-4'
        }`}
        data-computer-card={payload.provider ?? 'computer'}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 shrink-0 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center">
            <Monitor className="w-5 h-5 text-amber-300" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-grow">
            <p className="text-neutral-200 font-medium">Computer</p>
            <p className="text-white/60 text-xs truncate">{task}</p>
          </div>
          <span
            className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm ${
              stage === 'done'
                ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                : 'bg-white/10 border-white/10 text-white/60'
            }`}
          >
            {stage === 'done' && <Check className="w-4 h-4" aria-hidden="true" />}
            {stage === 'done' ? 'Done' : 'Skipped'}
          </span>
        </div>
        {stage === 'done' && !readOnly && payload.view_token && (
          <button
            type="button"
            onClick={() => setTakeoverOpen(true)}
            className="mt-3 px-4 py-2 rounded-lg bg-neutral-100/10 hover:bg-neutral-100/15 border border-neutral-700 text-neutral-300 text-sm font-medium"
          >
            Open computer
          </button>
        )}
        {takeoverOpen && (
          <AgentComputerTakeover
            card={payload}
            onDone={() => setTakeoverOpen(false)}
            onSkip={() => setTakeoverOpen(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div
      className={`${className} bg-black/60 backdrop-blur-lg rounded-2xl border border-white/10 ${
        compact ? 'p-2.5' : 'p-4'
      }`}
      data-computer-card={payload.provider ?? 'computer'}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 shrink-0 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center">
          <Monitor className="w-5 h-5 text-amber-300" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-grow">
          <p className="text-neutral-200 font-medium">Computer</p>
          <p className="text-white/60 text-sm whitespace-normal break-words">{task}</p>
        </div>
        <span className="shrink-0 inline-flex items-center rounded-full border bg-amber-400/15 border-amber-400/30 text-amber-200 px-3 py-1.5 text-sm">
          Action needed
        </span>
      </div>
      {preview && (
        <div className="mt-3 rounded-xl overflow-hidden border border-white/10 bg-black">
          <img
            src={preview}
            alt="Live preview of the avatar computer"
            className="w-full max-h-48 object-cover object-top"
          />
        </div>
      )}
      {waiting.length > 0 && !compact && (
        <p className="mt-2 text-white/40 text-xs">
          Waiting on {waiting.join(', ')}
        </p>
      )}
      {!readOnly && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTakeoverOpen(true)}
            className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-black text-sm font-medium"
          >
            Take over
          </button>
          <button
            type="button"
            onClick={() => finish(COMPUTER_DECISION_DONE)}
            className="px-4 py-2 rounded-lg bg-neutral-100/10 hover:bg-neutral-100/15 border border-neutral-700 text-neutral-300 text-sm font-medium"
          >
            I&apos;m done
          </button>
          <button
            type="button"
            onClick={() => finish(COMPUTER_DECISION_SKIP)}
            className="px-4 py-2 rounded-lg text-white/50 hover:text-white/80 text-sm inline-flex items-center gap-1"
          >
            <SkipForward className="w-4 h-4" aria-hidden="true" />
            Skip
          </button>
        </div>
      )}
      {takeoverOpen && (
        <AgentComputerTakeover
          card={payload}
          onDone={() => finish(COMPUTER_DECISION_DONE)}
          onSkip={() => finish(COMPUTER_DECISION_SKIP)}
        />
      )}
    </div>
  );
};

export default ComputerHandoffCard;
