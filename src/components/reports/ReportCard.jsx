// src/components/reports/ReportCard.jsx
import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileBarChart,
  Loader2,
  MessageSquare,
  Trash2,
} from 'lucide-react';
import MarkdownText from '../ui/MarkdownText';
import ChartCard from '../ChartCard';
import { chartHasRenderableData } from '../../services/chartSpecs';
import { reportKindLabel } from './reportKind';

const formatDate = (value, withTime = false) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return withTime
    ? date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : date.toLocaleDateString(undefined, { dateStyle: 'medium' });
};

const periodLabel = (report) => {
  const start = formatDate(report?.period_start);
  const end = formatDate(report?.period_end);
  if (start && end) return `${start} – ${end}`;
  return start || end || '';
};

/**
 * One saved report: a collapsible card with the summary, the charts, and
 * the sources the report drew on.
 *
 * @param {Object} parameters
 * @param {Object} parameters.report The report record.
 * @param {boolean} [parameters.defaultOpen] Start expanded.
 * @param {Function} [parameters.onOpenInChat] Called with the report when the
 *   report came from a conversation (`thread_id` set).
 * @param {Function} [parameters.onDelete] Called with the report; when
 *   absent, no delete control is shown.
 * @param {boolean} [parameters.isDeleting]
 */
const ReportCard = ({
  report,
  defaultOpen = false,
  onOpenInChat = null,
  onDelete = null,
  isDeleting = false,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  if (!report) return null;

  const charts = (Array.isArray(report.charts) ? report.charts : []).filter(
    chartHasRenderableData
  );
  const sources = Array.isArray(report.sources) ? report.sources : [];
  const period = periodLabel(report);
  const bodyId = `report-${report.report_id ?? 'body'}`;

  return (
    <article className="bg-black/60 backdrop-blur-lg rounded-2xl border border-white/10 p-4 min-w-0">
      <button
        type="button"
        onClick={() => setIsOpen((wasOpen) => !wasOpen)}
        aria-expanded={isOpen}
        aria-controls={bodyId}
        className="w-full flex items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0 flex-grow">
          <div className="flex flex-wrap items-center gap-2">
            <FileBarChart className="w-4 h-4 text-amber-300 shrink-0" aria-hidden="true" />
            <span className="text-neutral-200 font-medium break-words">
              {report.title || 'Untitled report'}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide bg-white/10 border border-white/10 text-white/70">
              {reportKindLabel(report.kind)}
            </span>
          </div>
          <p className="text-white/50 text-xs mt-1">
            {formatDate(report.created_at, true)}
            {period ? ` · ${period}` : ''}
          </p>
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 shrink-0 text-white/60" aria-hidden="true" />
        ) : (
          <ChevronDown className="w-5 h-5 shrink-0 text-white/60" aria-hidden="true" />
        )}
      </button>

      {isOpen && (
        <div id={bodyId} className="mt-3 space-y-3">
          {report.summary_markdown ? (
            <MarkdownText text={report.summary_markdown} />
          ) : (
            <p className="text-white/50 text-sm">This report has no summary.</p>
          )}

          {charts.map((chart, index) => (
            <ChartCard key={chart.chart_id ?? `${report.report_id}-chart-${index}`} chart={chart} />
          ))}

          {sources.length > 0 && (
            <div>
              <p className="text-white/50 text-xs uppercase tracking-wide mb-1">Sources</p>
              <ul className="space-y-0.5">
                {sources.map((source, index) => {
                  const label =
                    typeof source === 'string'
                      ? source
                      : source?.title || source?.label || source?.name || source?.url || JSON.stringify(source);
                  const href = typeof source === 'object' ? source?.url : null;
                  return (
                    <li key={`${label}-${index}`} className="text-white/70 text-xs break-words">
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 underline text-amber-300 hover:text-amber-200"
                        >
                          {label}
                          <ExternalLink className="w-3 h-3" aria-hidden="true" />
                        </a>
                      ) : (
                        label
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {report.thread_id && onOpenInChat && (
              <button
                type="button"
                onClick={() => onOpenInChat(report)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-200 text-sm"
              >
                <MessageSquare className="w-4 h-4" aria-hidden="true" />
                Open in chat
              </button>
            )}
            {onDelete &&
              (isConfirmingDelete ? (
                <span className="inline-flex items-center gap-2 text-sm">
                  <span className="text-red-200">Delete this report?</span>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => onDelete(report)}
                    className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-sm disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    {isDeleting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                    Delete
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => setIsConfirmingDelete(false)}
                    className="px-3 py-1.5 rounded-lg text-white/60 hover:text-neutral-100 text-sm"
                  >
                    Keep
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(true)}
                  className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white/60 hover:text-red-300 hover:bg-red-500/10 text-sm"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                  Delete
                </button>
              ))}
          </div>
        </div>
      )}
    </article>
  );
};

export default ReportCard;
