// src/components/factReview/FactReviewCard.jsx
//
// One editable pending change, and the wording around it. The avatar raises
// these two ways — as a pause in the conversation when it wants a fact
// corrected or a researched contradiction settled, and as a list in avatar
// settings for the contradictions still waiting. Both show the same card, so a
// person learns this control once.

import React from 'react';

import {
  ACTION_CHOICE_BUTTON_TYPE,
  actionChoiceButtonClassName,
} from './factReviewActionChoice';

export const ACTION_ORDER = ['accept', 'remove', 'skip'];

// Used only when the payload omits `action_labels`. The server ships its own
// wording, and that wording wins, so these two never disagree in front of a user.
export const DEFAULT_ACTION_LABELS = {
  accept: 'Accept Edit',
  remove: 'Remove the Document',
  skip: 'Leave the document unchanged',
};

export const PANEL_CLASSES =
  'self-start w-full bg-black/60 backdrop-blur-lg rounded-2xl border border-white/10 p-4 sm:p-6 space-y-4';
export const PRIMARY_BUTTON_CLASSES =
  'px-4 py-2 rounded border border-neutral-700 bg-neutral-200 text-neutral-900 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:opacity-50 disabled:cursor-not-allowed';
export const SECONDARY_BUTTON_CLASSES =
  'px-4 py-2 rounded border border-neutral-700 bg-black/60 text-neutral-200 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:opacity-50 disabled:cursor-not-allowed';
export const DANGER_BUTTON_CLASSES =
  'px-4 py-2 rounded border border-red-500/60 bg-red-600/80 text-neutral-200 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-50 disabled:cursor-not-allowed';
export const TEXTAREA_CLASSES =
  'w-full px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-neutral-200 placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50';

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
export function matchPercentOf(match) {
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
export function describeMatchKind(match) {
  return match?.kind === 'sentence'
    ? 'sentence in quote/long text'
    : 'fact';
}

/**
 * One matched document, with the decision to be made about it.
 */
export const FactReviewCard = ({ match, decision, actionLabels, onChange, isResuming }) => {
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

      <div className="text-sm text-neutral-200">
        <span className="font-semibold">Current document fact content: </span>
        <span className="text-white/90">{match.current_fact_content}</span>
      </div>

      {match.current_fact_context ? (
        <div className="text-xs text-white/60">
          Current document fact context: {match.current_fact_context}
        </div>
      ) : null}

      {hint ? (
        <div className="text-xs text-neutral-100/90">💡 {hint}</div>
      ) : null}

      <fieldset disabled={isResuming}>
        <legend className="text-xs text-white/60 mb-2">
          What should I do with this?
        </legend>
        <div className="flex flex-wrap gap-2">
          {ACTION_ORDER.map((action) => {
            const isSelected = decision.action === action;
            return (
              <button
                key={action}
                type={ACTION_CHOICE_BUTTON_TYPE}
                aria-pressed={isSelected}
                disabled={isResuming}
                className={actionChoiceButtonClassName({
                  selected: isSelected,
                  disabled: isResuming,
                })}
                onClick={() => onChange({ ...decision, action })}
              >
                {actionLabels[action]}
              </button>
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
            value={decision.correctedText ?? ''}
            disabled={isResuming}
            onChange={(changeEvent) =>
              onChange({
                ...decision,
                correctedText: changeEvent.target.value,
              })
            }
          />
        </label>
        <label className="block text-xs text-white/60">
          Suggested edit fact context (applied when you choose “
          {actionLabels.accept}”)
          <textarea
            className={`${TEXTAREA_CLASSES} mt-1`}
            rows={2}
            value={decision.correctedContext ?? ''}
            disabled={isResuming}
            onChange={(changeEvent) =>
              onChange({
                ...decision,
                correctedContext: changeEvent.target.value,
              })
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
