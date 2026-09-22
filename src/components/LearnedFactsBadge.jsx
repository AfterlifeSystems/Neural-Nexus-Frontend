// LearnedFactsBadge.jsx
//
// The chip on an avatar reply that says a fact was stored this turn. Amber
// matches the "Told in chat" chip on the settings list, so a fact learned
// here and the same fact on the settings screen read as one thing. The chip
// names whose fact was stored so a user fact and an avatar self-fact are
// not read as the same thing.

import React from 'react';
import { BookOpen } from 'lucide-react';
import { learnedFactsOf } from '../services/learnedFacts';

const VISIBLE_FACT_LIMIT = 3;

const KIND_LABELS = {
  user: 'Learned about you',
  identity: 'Learned about me',
  preference: 'Learned your preference',
  memory: 'Remembered',
};

/**
 * Visible chip text and accessible name for one learned fact.
 *
 * @param {{fact: string, kind: string}} entry
 * @returns {string}
 */
function learnedFactLabel(entry) {
  const kindLabel = KIND_LABELS[entry.kind] || 'Learned';
  return `${kindLabel} · ${entry.fact}`;
}

/**
 * @param {Object} props
 * @param {Object} [props.message] The avatar reply.
 * @param {Array} [props.facts] Facts already read off the message.
 * @param {string} [props.className]
 */
export default function LearnedFactsBadge({ message, facts, className = '' }) {
  const entries = Array.isArray(facts) ? facts : learnedFactsOf(message);
  if (entries.length === 0) return null;

  const visible = entries.slice(0, VISIBLE_FACT_LIMIT);
  const hiddenCount = entries.length - visible.length;

  return (
    <div
      className={`mb-1 flex flex-wrap gap-1 ${className}`.trim()}
      role="status"
      aria-label={
        entries.length === 1
          ? learnedFactLabel(entries[0])
          : `Learned ${entries.length} facts`
      }
    >
      {visible.map((entry) => {
        const label = learnedFactLabel(entry);
        return (
          <span
            key={`${entry.kind}:${entry.fact}`}
            title={label}
            className="inline-flex items-center gap-1 max-w-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide rounded-full border bg-amber-500/20 text-amber-200 border-amber-400/40"
          >
            <BookOpen className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{label}</span>
          </span>
        );
      })}
      {hiddenCount > 0 && (
        <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide rounded-full border bg-amber-500/20 text-amber-200 border-amber-400/40">
          +{hiddenCount} more
        </span>
      )}
    </div>
  );
}
