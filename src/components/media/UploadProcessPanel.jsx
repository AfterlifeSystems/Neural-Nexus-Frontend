// src/components/media/UploadProcessPanel.jsx
//
// In-place progress for an identity-media job started from the settings
// Upload section. The same checklist the toast used, plus a bar and a cancel
// that hits POST /media_job/{job_id}/cancel.
import React from 'react';
import { Ban, Check, Circle, Loader2, X } from 'lucide-react';
import { pipelineProgress } from '../../services/mediaProcessSteps.js';

/**
 * @param {Object} parameters
 * @param {Object} parameters.job Running or finished upload job.
 * @param {Function} parameters.onCancel Cancel the master job.
 * @param {Function} [parameters.onCancelItem] Cancel one child job.
 * @param {Function} [parameters.onDismiss] Hide a finished card.
 */
const UploadProcessPanel = ({ job, onCancel, onCancelItem, onDismiss }) => {
  const { percent, label } = pipelineProgress(job.steps);
  const isRunning = job.status === 'running';
  const barWidth = job.status === 'success' ? 100 : percent;

  return (
    <div className="rounded-xl border border-white/10 bg-black/50 p-3 sm:p-4 space-y-3">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-neutral-100 truncate">
            {job.title}
          </p>
          <p className="text-xs text-white/55 mt-0.5">
            {job.status === 'cancelled'
              ? 'Cancelled'
              : job.status === 'error'
                ? job.error || 'Failed'
                : job.cancelling
                  ? 'Cancelling…'
                  : label}
          </p>
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
        aria-label={label}
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

      {job.items?.length > 0 && (
        <ul className="space-y-1 border-t border-white/10 pt-2">
          {job.items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-2 text-xs text-white/60"
            >
              <span className="flex-1 min-w-0 truncate">{item.label}</span>
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
