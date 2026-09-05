// src/components/ui/ProgressBar.jsx
import React from 'react';

/**
 * A thin progress bar in the house accent, with optional milestone ticks.
 *
 * The voice corpus fills toward several thresholds at once (a voice audio
 * model at one minute, a better one at two, a professional voice model at thirty),
 * so the bar can mark each as a tick and the label names the next one to reach.
 *
 * @param {Object} parameters
 * @param {number} parameters.value Current amount.
 * @param {number} parameters.max The amount that fills the bar.
 * @param {{value: number, label: string}[]} [parameters.milestones] Ticks.
 * @param {string} [parameters.label] Accessible name.
 * @param {string} [parameters.className] Extra classes for the track.
 */
const ProgressBar = ({
  value,
  max,
  milestones = [],
  label,
  className = '',
}) => {
  const safeMax = max > 0 ? max : 1;
  const fraction = Math.max(0, Math.min(1, (value ?? 0) / safeMax));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={Math.min(value ?? 0, safeMax)}
      className={`relative h-2 w-full rounded-full bg-white/10 overflow-visible ${className}`}
    >
      <div
        className="h-full rounded-full bg-amber-400 transition-[width] duration-500"
        style={{ width: `${fraction * 100}%` }}
      />
      {milestones.map((milestone) => {
        const position = Math.max(0, Math.min(1, milestone.value / safeMax));
        const reached = (value ?? 0) >= milestone.value;
        return (
          <span
            key={milestone.label}
            title={milestone.label}
            className={`absolute -top-1 h-4 w-0.5 rounded ${
              reached ? 'bg-amber-300' : 'bg-white/30'
            }`}
            style={{ left: `calc(${position * 100}% - 1px)` }}
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
};

export default ProgressBar;
