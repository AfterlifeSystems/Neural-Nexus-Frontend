// LearnedFactsBadge.jsx
//
// The chips on an avatar reply that account for every fact the person shared
// this turn. Amber matches the "Told in chat" chip on the settings list, so a
// fact learned here and the same fact on the settings screen read as one
// thing. The chip names whose fact it is so a user fact and an avatar
// self-fact are not read as the same thing, and names what happened to the
// fact: learned, already known, updated by a correction, or removed.

import React, { useState } from 'react';
import { BookOpen, Check, Pencil, Trash2 } from 'lucide-react';
import { learnedFactsOf } from '../services/learnedFacts';

const VISIBLE_FACT_LIMIT = 3;

const LEARNED_KIND_LABELS = {
  user: 'Learned about you',
  identity: 'Learned about me',
  preference: 'Learned your preference',
  memory: 'Remembered',
};

const KNOWN_KIND_LABELS = {
  user: 'Already knew about you',
  identity: 'Already knew about me',
  preference: 'Already knew your preference',
  memory: 'Already remembered',
};

const STATUS_STYLES = {
  learned: 'bg-amber-500/20 text-amber-200 border-amber-400/40',
  known: 'bg-slate-500/15 text-slate-300 border-slate-400/30',
  updated: 'bg-sky-500/20 text-sky-200 border-sky-400/40',
  removed: 'bg-rose-500/15 text-rose-200 border-rose-400/40',
};

const STATUS_ICONS = {
  learned: BookOpen,
  known: Check,
  updated: Pencil,
  removed: Trash2,
};

const EXPAND_TOGGLE_STYLE =
  'inline-flex items-center px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide rounded-full border bg-amber-500/20 text-amber-200 border-amber-400/40 hover:bg-amber-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300';

/**
 * Visible chip text and accessible name for one fact.
 *
 * @param {{fact: string, kind: string, status: string, previousFact?: string}} entry
 * @returns {string}
 */
function learnedFactLabel(entry) {
  if (entry.status === 'known') {
    return `${KNOWN_KIND_LABELS[entry.kind] || 'Already knew'} · ${entry.fact}`;
  }
  if (entry.status === 'updated') {
    return entry.previousFact
      ? `Updated · ${entry.previousFact} → ${entry.fact}`
      : `Updated · ${entry.fact}`;
  }
  if (entry.status === 'removed') {
    return `Removed · ${entry.fact}`;
  }
  return `${LEARNED_KIND_LABELS[entry.kind] || 'Learned'} · ${entry.fact}`;
}

/**
 * Accessible summary of every fact on the reply, counted by status.
 *
 * @param {Array<{status: string}>} entries
 * @returns {string}
 */
function learnedFactsSummary(entries) {
  const counts = entries.reduce((countsByStatus, entry) => {
    countsByStatus[entry.status] = (countsByStatus[entry.status] || 0) + 1;
    return countsByStatus;
  }, {});
  const parts = [];
  if (counts.learned) parts.push(`learned ${counts.learned}`);
  if (counts.known) parts.push(`already knew ${counts.known}`);
  if (counts.updated) parts.push(`updated ${counts.updated}`);
  if (counts.removed) parts.push(`removed ${counts.removed}`);
  const summary = parts.join(', ');
  return `Facts: ${summary.charAt(0).toUpperCase()}${summary.slice(1)}`;
}

/**
 * @param {Object} props
 * @param {Object} [props.message] The avatar reply.
 * @param {Array} [props.facts] Facts already read off the message.
 * @param {string} [props.className]
 */
export default function LearnedFactsBadge({ message, facts, className = '' }) {
  const [expanded, setExpanded] = useState(false);
  const entries = Array.isArray(facts) ? facts : learnedFactsOf(message);
  if (entries.length === 0) return null;

  const visible = expanded ? entries : entries.slice(0, VISIBLE_FACT_LIMIT);
  const hiddenCount = entries.length - Math.min(entries.length, VISIBLE_FACT_LIMIT);

  return (
    <div
      className={`mb-1 flex flex-wrap gap-1 ${className}`.trim()}
      role="status"
      aria-label={
        entries.length === 1
          ? learnedFactLabel(entries[0])
          : learnedFactsSummary(entries)
      }
    >
      {visible.map((entry) => {
        const label = learnedFactLabel(entry);
        const status = STATUS_STYLES[entry.status] ? entry.status : 'learned';
        const StatusIcon = STATUS_ICONS[status];
        return (
          <span
            key={`${status}:${entry.kind}:${entry.fact}`}
            title={label}
            className={`inline-flex items-center gap-1 max-w-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide rounded-full border ${STATUS_STYLES[status]}`}
          >
            <StatusIcon className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{label}</span>
          </span>
        );
      })}
      {hiddenCount > 0 && (
        <button
          type="button"
          className={EXPAND_TOGGLE_STYLE}
          aria-expanded={expanded}
          onClick={() => setExpanded((isExpanded) => !isExpanded)}
        >
          {expanded ? 'Show fewer' : `+${hiddenCount} more`}
        </button>
      )}
    </div>
  );
}
