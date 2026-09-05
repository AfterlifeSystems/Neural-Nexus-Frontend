// AvatarIdentityFacts.jsx
//
// "What <name> has learned": everything the avatar holds about its OWN
// identity, read from GET /avatar_identity_facts. Four groups arrive in one
// list — facts the owner told the avatar in chat, first-person facts
// extracted from uploads, traits derived by analysis, and episodic memories —
// each row naming its group so the owner can tell a taught fact from a
// derived one. The API answers 403 for anyone but the creator, so this card
// is only ever mounted on the owner's settings screen.
//
// The owner can forget a fact (DELETE) or rewrite one in place (PUT). Edits
// keep the row's key, so the avatar reads the corrected wording on its next
// turn rather than holding both versions.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  deleteAvatarIdentityFact,
  listAvatarIdentityFacts,
  updateAvatarIdentityFact,
} from '../services/avatarService';

// How each group is named and coloured. The chip says where the fact came
// from; the description under a row expands on that in a sentence.
export const FACT_GROUP_PRESENTATION = {
  conversation: {
    filterLabel: 'From conversations',
    chip: 'Told in chat',
    badgeClassName: 'bg-amber-500/20 text-amber-200 border-amber-400/40',
    description: 'Told to the avatar in a conversation',
  },
  media: {
    filterLabel: 'From uploads',
    chip: 'From upload',
    badgeClassName: 'bg-sky-500/20 text-sky-200 border-sky-400/40',
    description: 'Extracted from uploaded media',
  },
  analysis: {
    filterLabel: 'Analysis',
    chip: 'Analysis',
    badgeClassName: 'bg-violet-500/20 text-violet-200 border-violet-400/40',
    description: 'Derived by analysing the uploads',
  },
  memory: {
    filterLabel: 'Memories',
    chip: 'Memory',
    badgeClassName: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40',
    description: 'Remembered from a conversation',
  },
};

export const FACT_GROUP_ORDER = ['conversation', 'media', 'analysis', 'memory'];

/**
 * A stable identity for one row: the store namespace and key together name
 * exactly one document.
 *
 * @param {Object} fact A row from listAvatarIdentityFacts.
 * @returns {string}
 */
export const factRowKey = (fact) =>
  `${(fact.namespace ?? []).join('/')}::${fact.key ?? fact.factId ?? ''}`;

/**
 * Filter the rows by group and by a text search over the fact and its context.
 *
 * @param {Array<Object>} facts
 * @param {string} groupFilter One of FACT_GROUP_ORDER, or 'all'.
 * @param {string} searchQuery
 * @returns {Array<Object>}
 */
export const filterFacts = (facts, groupFilter, searchQuery) => {
  const normalizedQuery = (searchQuery ?? '').trim().toLowerCase();
  return facts.filter((fact) => {
    if (groupFilter !== 'all' && fact.learnedFrom !== groupFilter) return false;
    if (!normalizedQuery) return true;
    return (
      (fact.fact ?? '').toLowerCase().includes(normalizedQuery) ||
      (fact.context ?? '').toLowerCase().includes(normalizedQuery) ||
      (fact.sourceLabel ?? '').toLowerCase().includes(normalizedQuery) ||
      (fact.feature ?? '').toLowerCase().includes(normalizedQuery)
    );
  });
};

const describeFeature = (feature) =>
  feature ? feature.replace(/_/g, ' ') : null;

/**
 * One learned fact, with its group chip, expandable context, and the edit and
 * forget controls.
 */
const IdentityFactRow = ({ fact, onDelete, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [draftFact, setDraftFact] = useState(fact.fact);
  const [draftContext, setDraftContext] = useState(fact.context ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const presentation =
    FACT_GROUP_PRESENTATION[fact.learnedFrom] ??
    FACT_GROUP_PRESENTATION.conversation;
  const featureLabel = describeFeature(fact.feature);

  const beginEdit = () => {
    setDraftFact(fact.fact);
    setDraftContext(fact.context ?? '');
    setIsEditing(true);
  };

  const saveEdit = async () => {
    const trimmedFact = draftFact.trim();
    if (!trimmedFact) {
      toast.error('A fact cannot be empty. Use Forget to remove it instead.');
      return;
    }
    setIsSaving(true);
    try {
      await onSave(fact, {
        fact: trimmedFact,
        context: draftContext.trim(),
      });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (
      !window.confirm(
        `Forget "${fact.fact}"? The avatar will no longer know this. This cannot be undone.`
      )
    ) {
      return;
    }
    setIsDeleting(true);
    try {
      await onDelete(fact);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-3 bg-black/60 border border-white/10 rounded-lg hover:bg-white/10 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className={`px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide rounded-full border ${presentation.badgeClassName}`}
            >
              {presentation.chip}
            </span>
            {featureLabel && (
              <span className="px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide rounded-full border bg-black/50 text-white/70 border-white/10">
                {featureLabel}
              </span>
            )}
            {fact.sourceLabel && (
              <span
                className="text-white/50 text-xs truncate max-w-[16rem]"
                title={fact.sourceLabel}
              >
                {fact.sourceLabel}
              </span>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={draftFact}
                onChange={(event) => setDraftFact(event.target.value)}
                rows={2}
                aria-label="Fact"
                className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              />
              <textarea
                value={draftContext}
                onChange={(event) => setDraftContext(event.target.value)}
                rows={2}
                aria-label="Context"
                placeholder="Context (optional): where this came from, or what surrounded it"
                className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-neutral-200 placeholder-white/40 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={isSaving}
                  className="px-3 py-1.5 text-sm bg-amber-400 hover:bg-amber-300 text-neutral-900 font-semibold rounded-lg border border-amber-400 inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  disabled={isSaving}
                  className="px-3 py-1.5 text-sm bg-black/50 hover:bg-white/10 text-neutral-200 rounded-lg border border-white/10 inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <X size={14} />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-neutral-200 text-sm break-words">{fact.fact}</p>
              {fact.correctedFrom && (
                <p className="text-white/40 text-xs mt-0.5 line-through break-words">
                  {fact.correctedFrom}
                </p>
              )}
              <p className="text-white/40 text-xs mt-0.5">
                {presentation.description}
              </p>
              {fact.context && (
                <div className="mt-1">
                  <button
                    type="button"
                    onClick={() => setIsContextOpen((wasOpen) => !wasOpen)}
                    aria-expanded={isContextOpen}
                    className="inline-flex items-center gap-1 text-xs text-white/60 hover:text-neutral-100 transition-colors"
                  >
                    {isContextOpen ? (
                      <ChevronUp size={14} />
                    ) : (
                      <ChevronDown size={14} />
                    )}
                    Context
                  </button>
                  {isContextOpen && (
                    <p className="text-white/60 text-xs mt-1 break-words whitespace-pre-wrap">
                      {fact.context}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {!isEditing && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={beginEdit}
              disabled={isDeleting}
              title="Edit this fact"
              aria-label="Edit this fact"
              className="text-white/60 hover:text-neutral-100 transition-colors disabled:opacity-50"
            >
              <Pencil size={18} />
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={isDeleting}
              title="Forget this fact"
              aria-label="Forget this fact"
              className="text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
            >
              {isDeleting ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Trash2 size={18} />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * The owner-only card listing what the avatar has learned about itself.
 *
 * @param {Object} props
 * @param {string} props.assistantId The avatar.
 * @param {string} [props.avatarName] Shown in the heading and the empty state.
 */
const AvatarIdentityFacts = ({ assistantId, avatarName }) => {
  const [facts, setFacts] = useState([]);
  const [counts, setCounts] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [isLearningsOpen, setIsLearningsOpen] = useState(true);

  const load = useCallback(async () => {
    if (!assistantId) return;
    setIsLoading(true);
    try {
      const listing = await listAvatarIdentityFacts(assistantId);
      setFacts(listing.facts);
      setCounts(listing.counts);
      setLoadError(null);
    } catch (listError) {
      console.error('Loading what the avatar has learned failed:', listError);
      setFacts([]);
      setCounts({});
      setLoadError(
        listError?.message ?? 'What this avatar has learned could not be listed.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [assistantId]);

  useEffect(() => {
    load();
  }, [load]);

  // A filter whose last row was forgotten falls back to everything rather
  // than an empty list with no explanation.
  useEffect(() => {
    if (groupFilter !== 'all' && !counts[groupFilter]) {
      setGroupFilter('all');
    }
  }, [counts, groupFilter]);

  const visibleFacts = useMemo(
    () => filterFacts(facts, groupFilter, searchQuery),
    [facts, groupFilter, searchQuery]
  );

  const handleDelete = async (fact) => {
    try {
      await deleteAvatarIdentityFact(assistantId, fact);
      const rowKey = factRowKey(fact);
      setFacts((previous) =>
        previous.filter((candidate) => factRowKey(candidate) !== rowKey)
      );
      setCounts((previous) => ({
        ...previous,
        [fact.learnedFrom]: Math.max(0, (previous[fact.learnedFrom] ?? 1) - 1),
      }));
      toast.success('Fact forgotten');
    } catch (deleteError) {
      toast.error(`Could not forget that fact: ${deleteError.message}`);
    }
  };

  const handleSave = async (fact, edit) => {
    try {
      const updated = await updateAvatarIdentityFact(assistantId, {
        namespace: fact.namespace,
        key: fact.key,
        fact: edit.fact,
        context: edit.context,
      });
      const rowKey = factRowKey(fact);
      setFacts((previous) =>
        previous.map((candidate) =>
          factRowKey(candidate) === rowKey ? { ...candidate, ...updated } : candidate
        )
      );
      toast.success('Fact updated');
    } catch (saveError) {
      toast.error(`Could not update that fact: ${saveError.message}`);
      throw saveError;
    }
  };

  const totalCount = facts.length;

  return (
    <div className="bg-black/60 backdrop-blur-lg rounded-2xl border border-white/10 p-6">
      <div
        className={`flex items-center justify-between gap-3 ${
          isLearningsOpen ? 'mb-4' : ''
        }`}
      >
        <button
          type="button"
          onClick={() => setIsLearningsOpen((wasOpen) => !wasOpen)}
          aria-expanded={isLearningsOpen}
          aria-controls="avatar-learnings"
          className="flex items-center gap-2 min-w-0 flex-1 text-left text-xl font-semibold text-neutral-200 hover:text-white transition-colors"
        >
          <BookOpen size={20} className="shrink-0" />
          <span className="truncate">
            What {avatarName ?? 'this avatar'} has learned
          </span>
          {totalCount > 0 && (
            <span className="text-sm font-normal text-white/50 shrink-0">
              {totalCount}
            </span>
          )}
          {isLearningsOpen ? (
            <ChevronUp size={20} className="shrink-0 text-white/60" />
          ) : (
            <ChevronDown size={20} className="shrink-0 text-white/60" />
          )}
        </button>
        <button
          type="button"
          onClick={load}
          disabled={isLoading}
          title="Refresh"
          aria-label="Refresh what the avatar has learned"
          className="shrink-0 p-2 rounded-lg bg-black/50 hover:bg-white/10 text-neutral-200 border border-white/10 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>
      {isLearningsOpen && (
        <div id="avatar-learnings">
          <p className="text-white/50 text-sm mb-4">
            Only you can see this. These are the facts, traits, and memories
            the avatar holds about who it is — taught in chat, read from your
            uploads, or derived from them. Edit one to correct it, or forget it
            entirely.
          </p>

          {totalCount > 0 && (
            <div className="mb-4 space-y-3">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search what the avatar has learned…"
                  aria-label="Search what the avatar has learned"
                  className="w-full pl-9 pr-3 py-2 bg-black/50 border border-white/10 rounded-lg text-neutral-200 placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/50 text-sm"
                />
              </div>
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="Filter by where the fact came from"
              >
                {[
                  'all',
                  ...FACT_GROUP_ORDER.filter((group) => counts[group]),
                ].map((group) => {
                  const isSelected = groupFilter === group;
                  const count = group === 'all' ? totalCount : counts[group];
                  const label =
                    group === 'all'
                      ? 'All'
                      : FACT_GROUP_PRESENTATION[group].filterLabel;
                  return (
                    <button
                      key={group}
                      type="button"
                      onClick={() => setGroupFilter(group)}
                      aria-pressed={isSelected}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        isSelected
                          ? 'bg-neutral-200 text-neutral-900 border-neutral-200'
                          : 'bg-black/60 text-white/70 border-white/10 hover:bg-white/10 hover:text-neutral-100'
                      }`}
                    >
                      {label}
                      <span className="ml-1 opacity-70">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {totalCount > 0 ? (
              visibleFacts.length > 0 ? (
                visibleFacts.map((fact) => (
                  <IdentityFactRow
                    key={factRowKey(fact)}
                    fact={fact}
                    onDelete={handleDelete}
                    onSave={handleSave}
                  />
                ))
              ) : (
                <p className="text-white/40 text-sm italic">
                  Nothing learned matches this search or filter.
                </p>
              )
            ) : loadError ? (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-300 text-sm">{loadError}</p>
                <button
                  type="button"
                  onClick={load}
                  className="mt-2 px-3 py-1.5 text-sm bg-black/50 hover:bg-white/10 text-neutral-200 rounded-lg border border-white/10 transition-colors"
                >
                  Try again
                </button>
              </div>
            ) : isLoading ? (
              <p className="text-white/40 text-sm italic inline-flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                Reading what {avatarName ?? 'this avatar'} has learned…
              </p>
            ) : (
              <p className="text-white/40 text-sm italic">
                Nothing learned yet. Tell {avatarName ?? 'this avatar'} about
                themselves in chat, or upload media for them to learn from.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AvatarIdentityFacts;
