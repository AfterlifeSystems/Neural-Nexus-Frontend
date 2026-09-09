// src/components/reports/ReportsSection.jsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronDown,
  ChevronUp,
  FileBarChart,
  Loader2,
  Search,
} from 'lucide-react';
import ReportCard from './ReportCard';
import { reportKindLabel } from './reportKind';
import { deleteReport, listReports } from '../../services/avatarService';
import { showRequestFailureToast } from '../requestFailureToast';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

/**
 * The `kinds` a `GET /reports` answer carries, as `{kind, count}` rows
 * whatever shape the API used: plain strings, or objects with a count.
 *
 * @param {*} kinds The response's `kinds`.
 * @returns {{kind: string, count: number|null}[]}
 */
function normalizeKinds(kinds) {
  if (!Array.isArray(kinds)) return [];
  return kinds
    .map((entry) =>
      typeof entry === 'string'
        ? { kind: entry, count: null }
        : { kind: entry?.kind ?? entry?.name ?? '', count: entry?.count ?? null }
    )
    .filter((entry) => entry.kind);
}

/**
 * Newest first, by creation time.
 *
 * @param {Object[]} reports
 * @returns {Object[]}
 */
function newestFirst(reports) {
  return [...reports].sort((left, right) => {
    const leftTime = new Date(left?.created_at ?? 0).getTime() || 0;
    const rightTime = new Date(right?.created_at ?? 0).getTime() || 0;
    return rightTime - leftTime;
  });
}

/**
 * The reports the personal avatar has written: scheduled analytics, website
 * audits, and the summaries an analysis turn saved.
 *
 * A collapsible section like the others on the settings tab. Search, a kind
 * chip row (the kinds come from the API's answer, so a new report kind needs
 * no change here), and a date range narrow the list; "Load more" pages
 * through the rest. `?section=reports` scrolls the section into view, the
 * way `?section=connections` does for connectors.
 *
 * @param {Object} parameters
 * @param {string} parameters.assistantId The avatar whose reports are listed.
 * @param {string} [parameters.avatarName] For the heading.
 */
const ReportsSection = ({ assistantId, avatarName }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sectionRef = useRef(null);
  const [isOpen, setIsOpen] = useState(true);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [kind, setKind] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reports, setReports] = useState([]);
  const [kinds, setKinds] = useState([]);
  const [total, setTotal] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [deletingReportId, setDeletingReportId] = useState(null);
  const loadSequenceRef = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(
    async ({ offset = 0, append = false } = {}) => {
      loadSequenceRef.current += 1;
      const sequence = loadSequenceRef.current;
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      try {
        const response = await listReports({
          assistantId,
          query: debouncedQuery,
          kind,
          from: fromDate,
          to: toDate,
          limit: PAGE_SIZE,
          offset,
        });
        if (sequence !== loadSequenceRef.current) return;
        const page = Array.isArray(response?.reports) ? response.reports : [];
        const responseTotal =
          typeof response?.total === 'number' ? response.total : null;
        setReports((previous) => {
          const merged = append ? [...previous, ...page] : page;
          const seen = new Set();
          return newestFirst(
            merged.filter((report) => {
              const key = report?.report_id ?? JSON.stringify(report);
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            })
          );
        });
        setTotal(responseTotal);
        setHasMore(
          responseTotal != null
            ? offset + page.length < responseTotal
            : page.length === PAGE_SIZE
        );
        const listedKinds = normalizeKinds(response?.kinds);
        if (listedKinds.length > 0 || !append) {
          setKinds((previous) => (listedKinds.length > 0 ? listedKinds : previous));
        }
      } catch (loadError) {
        if (sequence !== loadSequenceRef.current) return;
        console.debug('Reports could not be loaded:', loadError);
        if (!append) setReports([]);
      } finally {
        if (sequence === loadSequenceRef.current) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [assistantId, debouncedQuery, kind, fromDate, toDate]
  );

  useEffect(() => {
    if (!assistantId) return;
    load();
  }, [assistantId, load]);

  useEffect(() => {
    if (searchParams.get('section') === 'reports' && sectionRef.current) {
      setIsOpen(true);
      sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [searchParams, isLoading]);

  const handleDelete = async (report) => {
    const reportId = report?.report_id;
    if (!reportId) return;
    setDeletingReportId(reportId);
    try {
      await deleteReport(reportId);
      setReports((previous) =>
        previous.filter((candidate) => candidate.report_id !== reportId)
      );
      setTotal((previous) => (previous == null ? previous : Math.max(0, previous - 1)));
      toast.success('Report deleted.');
    } catch (deleteError) {
      showRequestFailureToast(deleteError, 'Could not delete that report.');
    } finally {
      setDeletingReportId(null);
    }
  };

  const openInChat = (report) => {
    const avatarForThread = report?.assistant_id ?? assistantId;
    if (!report?.thread_id || !avatarForThread) return;
    navigate(
      `/chat/${encodeURIComponent(avatarForThread)}?thread=${encodeURIComponent(
        report.thread_id
      )}`
    );
  };

  const isFiltered = Boolean(debouncedQuery || kind || fromDate || toDate);
  const countLabel = total ?? reports.length;

  return (
    <div
      ref={sectionRef}
      id="reports"
      className="bg-black/60 backdrop-blur-lg rounded-2xl border border-white/10 p-4 sm:p-6 min-w-0"
    >
      <button
        type="button"
        onClick={() => setIsOpen((wasOpen) => !wasOpen)}
        aria-expanded={isOpen}
        aria-controls="avatar-reports"
        className={`w-full flex items-center justify-between gap-3 text-left text-xl font-semibold text-neutral-200 hover:text-white transition-colors ${
          isOpen ? 'mb-4' : ''
        }`}
      >
        <span className="flex items-center gap-2 min-w-0">
          <FileBarChart size={20} className="shrink-0" aria-hidden="true" />
          <span className="truncate">
            Reports{avatarName ? ` from ${avatarName}` : ''}
          </span>
          {countLabel > 0 && (
            <span className="text-sm font-normal text-white/50 shrink-0">
              {countLabel}
            </span>
          )}
        </span>
        {isOpen ? (
          <ChevronUp size={20} className="shrink-0 text-white/60" aria-hidden="true" />
        ) : (
          <ChevronDown size={20} className="shrink-0 text-white/60" aria-hidden="true" />
        )}
      </button>

      {isOpen && (
        <div id="avatar-reports" className="space-y-4">
          <div className="space-y-3">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(changeEvent) => setQuery(changeEvent.target.value)}
                placeholder="Search reports…"
                aria-label="Search reports"
                className="w-full pl-9 pr-3 py-2 bg-black/50 border border-white/10 rounded-lg text-neutral-200 text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              />
            </div>

            {kinds.length > 0 && (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Report kind">
                <button
                  type="button"
                  onClick={() => setKind('')}
                  aria-pressed={kind === ''}
                  className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                    kind === ''
                      ? 'bg-white/15 border-white/20 text-neutral-100'
                      : 'bg-white/5 border-white/10 text-white/60 hover:text-neutral-100'
                  }`}
                >
                  All kinds
                </button>
                {kinds.map((entry) => (
                  <button
                    key={entry.kind}
                    type="button"
                    onClick={() => setKind((current) => (current === entry.kind ? '' : entry.kind))}
                    aria-pressed={kind === entry.kind}
                    className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                      kind === entry.kind
                        ? 'bg-white/15 border-white/20 text-neutral-100'
                        : 'bg-white/5 border-white/10 text-white/60 hover:text-neutral-100'
                    }`}
                  >
                    {reportKindLabel(entry.kind)}
                    {entry.count != null ? ` · ${entry.count}` : ''}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <label className="inline-flex items-center gap-2 text-white/60">
                From
                <input
                  type="date"
                  value={fromDate}
                  max={toDate || undefined}
                  onChange={(changeEvent) => setFromDate(changeEvent.target.value)}
                  className="px-2 py-1 bg-black/50 border border-white/10 rounded-lg text-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50 [color-scheme:dark]"
                />
              </label>
              <label className="inline-flex items-center gap-2 text-white/60">
                To
                <input
                  type="date"
                  value={toDate}
                  min={fromDate || undefined}
                  onChange={(changeEvent) => setToDate(changeEvent.target.value)}
                  className="px-2 py-1 bg-black/50 border border-white/10 rounded-lg text-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50 [color-scheme:dark]"
                />
              </label>
              {isFiltered && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setKind('');
                    setFromDate('');
                    setToDate('');
                  }}
                  className="text-white/50 hover:text-neutral-100 text-xs underline transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {isLoading ? (
            <p className="text-white/50 text-sm inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              Loading reports…
            </p>
          ) : reports.length === 0 ? (
            <p className="text-white/50 text-sm">
              {isFiltered
                ? 'No reports match those filters.'
                : 'No reports yet. Ask the avatar for an analysis, or connect an analytics account and let a scheduled report arrive here.'}
            </p>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <ReportCard
                  key={report.report_id}
                  report={report}
                  onOpenInChat={report.thread_id ? openInChat : null}
                  onDelete={handleDelete}
                  isDeleting={deletingReportId === report.report_id}
                />
              ))}
            </div>
          )}

          {!isLoading && hasMore && (
            <button
              type="button"
              disabled={isLoadingMore}
              onClick={() => load({ offset: reports.length, append: true })}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-200 text-sm disabled:opacity-50 transition-colors"
            >
              {isLoadingMore && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              Load more
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ReportsSection;
