// src/components/media/UploadProcessPanel.jsx
//
// In-place progress for an identity-media job started from the settings
// Upload section. The same checklist the toast used, plus a bar and a cancel
// that hits POST /media_job/{job_id}/cancel.
import React, { useEffect, useState } from 'react';
import {
  Ban,
  Check,
  Circle,
  File,
  FileAudio,
  FileText,
  FileVideo,
  Globe,
  Image as ImageIcon,
  Loader2,
  X,
} from 'lucide-react';
import {
  isGenericMediaLabel,
  pipelineProgress,
} from '../../services/mediaProcessSteps.js';
import { describeMediaJobTiming } from '../../services/mediaJobTiming.js';
import {
  describeDocumentKind,
  describeUrlKind,
  parseDocumentSourceUrl,
  summarizeUrlForDisplay,
} from '../AvatarDocumentRow';

const KIND_CHIP = {
  portrait: { label: 'Portrait', Icon: ImageIcon, iconClassName: 'text-purple-300' },
  voice: { label: 'Voice', Icon: FileAudio, iconClassName: 'text-emerald-300' },
  image: { label: 'Image', Icon: ImageIcon, iconClassName: 'text-purple-300' },
  audio: { label: 'Audio', Icon: FileAudio, iconClassName: 'text-emerald-300' },
  video: { label: 'Video', Icon: FileVideo, iconClassName: 'text-rose-300' },
  document: { label: 'Document', Icon: FileText, iconClassName: 'text-amber-300' },
  text: { label: 'Text', Icon: FileText, iconClassName: 'text-blue-300' },
  data: { label: 'Data', Icon: FileText, iconClassName: 'text-lime-300' },
};

const namedItemLabels = (job) =>
  (job.items ?? [])
    .map((item) => item.label)
    .filter((label) => label && !isGenericMediaLabel(label));

/**
 * @param {Object} job A stored upload card.
 * @returns {string} Filename, shortened URL, or a kind fallback.
 */
export const displayTitleForUploadJob = (job) => {
  const named = namedItemLabels(job);
  const raw = named.length === 1 ? named[0] : job.title;
  if (isGenericMediaLabel(raw)) {
    if (named.length > 1) return `${named.length} items`;
    return job.kind === 'portrait'
      ? 'Portrait upload'
      : job.kind === 'voice'
        ? 'Voice upload'
        : 'Document upload';
  }
  const sourceUrl = parseDocumentSourceUrl(raw);
  return sourceUrl ? summarizeUrlForDisplay(sourceUrl) : raw;
};

const kindChipForJob = (job) => {
  if (job.kind === 'portrait') return KIND_CHIP.portrait;
  if (job.kind === 'voice') return KIND_CHIP.voice;
  const label = namedItemLabels(job)[0] || job.title;
  const sourceUrl = parseDocumentSourceUrl(label);
  if (sourceUrl) {
    return {
      label: describeUrlKind(sourceUrl),
      Icon: Globe,
      iconClassName: 'text-sky-300',
    };
  }
  const documentKind = describeDocumentKind(label);
  if (documentKind && KIND_CHIP[documentKind]) return KIND_CHIP[documentKind];
  return { label: 'Upload', Icon: File, iconClassName: 'text-white/55' };
};

const shouldListItems = (job) => namedItemLabels(job).length > 1;

/**
 * "Running 11 min · about 39 min total · 28 min left" for a running upload,
 * ticking once a second so the elapsed time and the countdown move between
 * progress frames. Every running card has at least the elapsed time: the
 * card records when it started, and the server adds its estimate for speech.
 *
 * @param {Object} job A stored upload card.
 * @returns {string|null}
 */
const useJobTimingLine = (job) => {
  const isTicking = job.status === 'running' && job.timing != null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isTicking) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isTicking]);
  return describeMediaJobTiming(job, now);
};

/**
 * @param {Object} parameters
 * @param {Object} parameters.job Running or finished upload job.
 * @param {Function} parameters.onCancel Cancel the master job.
 * @param {Function} [parameters.onCancelItem] Cancel one child job.
 * @param {Function} [parameters.onDismiss] Hide a finished card.
 */
const UploadProcessPanel = ({ job, onCancel, onCancelItem, onDismiss }) => {
  const { percent, label } = pipelineProgress(job.steps);
  const timingLine = useJobTimingLine(job);
  const isRunning = job.status === 'running';
  const barWidth = job.status === 'success' ? 100 : percent;
  const title = displayTitleForUploadJob(job);
  const fullTitle = namedItemLabels(job)[0] || job.title || title;
  const chip = kindChipForJob(job);
  const ChipIcon = chip.Icon;
  const previewUrl =
    job.previewUrl ||
    job.items?.find((item) => item.previewUrl)?.previewUrl ||
    null;
  const showItemList = shouldListItems(job);

  return (
    <div className="rounded-xl border border-white/10 bg-black/50 p-3 sm:p-4 space-y-3">
      <div className="flex items-start gap-3">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt=""
            className="w-12 h-12 rounded-md object-cover border border-white/10 shrink-0 bg-black/40"
          />
        ) : (
          <div className="w-12 h-12 rounded-md border border-white/10 bg-black/40 flex items-center justify-center shrink-0">
            <ChipIcon
              className={`w-5 h-5 ${chip.iconClassName}`}
              aria-hidden="true"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-neutral-100 truncate" title={fullTitle}>
            {title}
          </p>
          <p className="text-xs text-white/55 mt-0.5 flex items-center gap-1.5 min-w-0">
            <span className="shrink-0 rounded-full border border-white/15 px-1.5 py-px text-[10px] uppercase tracking-wide text-white/60">
              {chip.label}
            </span>
            <span className="truncate">
              {job.status === 'cancelled'
                ? 'Cancelled'
                : job.status === 'error'
                  ? job.error || 'Failed'
                  : job.cancelling
                    ? 'Cancelling…'
                    : label}
            </span>
          </p>
          {timingLine && (
            <p
              className="text-xs text-white/45 mt-0.5 tabular-nums"
              data-testid="upload-timing"
            >
              {timingLine}
            </p>
          )}
        </div>
        {isRunning ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={job.cancelling}
            className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-white/15 text-white/70 hover:text-red-300 hover:border-red-300/40 hover:bg-red-400/10 disabled:opacity-50"
          >
            <Ban size={14} aria-hidden="true" />
            Cancel
          </button>
        ) : (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="shrink-0 p-1.5 rounded-md text-white/40 hover:text-neutral-200 hover:bg-white/10"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div
        className="h-1.5 rounded-full bg-white/10 overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={barWidth}
        aria-label={`${title}: ${label}`}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${
            job.status === 'error'
              ? 'bg-red-400'
              : job.status === 'cancelled'
                ? 'bg-white/30'
                : 'bg-amber-400'
          }`}
          style={{ width: `${barWidth}%` }}
        />
      </div>

      <ol className="space-y-1">
        {job.steps.map((step) => {
          const isActive = step.state === 'active';
          const isDone = step.state === 'done';
          const isError = step.state === 'error';
          const counted =
            step.total != null ? `${step.current ?? 0}/${step.total}` : null;
          return (
            <li
              key={step.id}
              className={`flex items-center gap-2 text-xs ${
                isDone
                  ? 'text-neutral-200'
                  : isActive
                    ? 'text-neutral-100'
                    : isError
                      ? 'text-red-300'
                      : 'text-white/45'
              }`}
            >
              {isDone ? (
                <Check className="w-3.5 h-3.5 text-amber-300 shrink-0" aria-hidden="true" />
              ) : isActive ? (
                <Loader2
                  className="w-3.5 h-3.5 text-amber-300 shrink-0 animate-spin"
                  aria-hidden="true"
                />
              ) : isError ? (
                <X className="w-3.5 h-3.5 text-red-300 shrink-0" aria-hidden="true" />
              ) : (
                <Circle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              )}
              <span className="flex-1 min-w-0">{step.label}</span>
              {counted && (
                <span className="tabular-nums text-white/45 shrink-0">
                  {counted}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {showItemList && (
        <ul className="space-y-1 border-t border-white/10 pt-2">
          {job.items
            .filter((item) => !isGenericMediaLabel(item.label))
            .map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-2 text-xs text-white/60"
              >
                <span className="flex-1 min-w-0 truncate" title={item.label}>
                  {item.label}
                </span>
                {isRunning && item.itemJobId && onCancelItem && (
                  <button
                    type="button"
                    onClick={() => onCancelItem(item.itemJobId)}
                    className="shrink-0 text-white/40 hover:text-red-300"
                    aria-label={`Cancel ${item.label}`}
                  >
                    <X size={14} />
                  </button>
                )}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
};

export default UploadProcessPanel;
