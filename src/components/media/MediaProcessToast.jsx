// src/components/media/MediaProcessToast.jsx
import React from 'react';
import { Check, Circle, Loader2, X } from 'lucide-react';

/**
 * One card for a media job: every pipeline step stays visible at 0/N from the
 * start and only leaves when the job finishes. A rotating sentence is what
 * made converting replace "Creating avatar portraits" and the emotion videos.
 *
 * @param {Object} parameters
 * @param {string} parameters.title What is being processed.
 * @param {Array<{id: string, label: string, state: string, current?: number, total?: number}>} parameters.steps
 * @param {'running'|'success'|'error'} parameters.status
 * @param {string} [parameters.error]
 */
const MediaProcessToast = ({ title, steps, status, error }) => {
  const allDone = steps.every((step) => step.state === 'done');
  return (
    <div className="max-w-sm w-full pointer-events-auto rounded-lg shadow-lg backdrop-blur-lg bg-[rgba(0,0,0,0.92)] ring-1 ring-white/15 p-4">
      <p className="text-sm font-medium text-neutral-100">{title}</p>
      <ol className="mt-2.5 space-y-1.5">
        {steps.map((step) => {
          const isActive = step.state === 'active';
          const isDone = step.state === 'done';
          const isError = step.state === 'error';
          const counted =
            step.total != null
              ? `${step.current ?? 0}/${step.total}`
              : null;
          return (
            <li
              key={step.id}
              className={`flex items-center gap-2 text-sm ${
                isDone
                  ? 'text-neutral-200'
                  : isActive
                    ? 'text-neutral-100'
                    : isError
                      ? 'text-red-300'
                      : 'text-white/55'
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
                <span className="tabular-nums text-xs text-white/50 shrink-0">
                  {counted}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {status === 'success' && allDone && (
        <p className="mt-2 text-xs text-amber-300">All steps complete.</p>
      )}
      {status === 'error' && error && (
        <p className="mt-2 text-xs text-red-300">{error}</p>
      )}
    </div>
  );
};

export default MediaProcessToast;
