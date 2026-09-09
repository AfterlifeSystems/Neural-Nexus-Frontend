// src/components/media/GenerationConfirmation.jsx
import React from 'react';
import Modal from '../ui/Modal';

/**
 * Confirm or cancel a spend on emotion images or idle-loop videos.
 *
 * Generation bills the image and video vendor. A full rebuild also deletes
 * the assets of that kind that exist. Nothing starts from a single press.
 *
 * @param {Object} parameters
 * @param {Object} parameters.confirmation From emotionMediaGenerationConfirmation.
 * @param {boolean} parameters.starting Whether the run is already starting.
 * @param {Function} parameters.onCancel Dismiss without generating.
 * @param {Function} parameters.onConfirm Start the run.
 */
const GenerationConfirmation = ({
  confirmation,
  starting,
  onCancel,
  onConfirm,
}) => (
  <Modal
    open
    onClose={starting ? () => {} : onCancel}
    title={confirmation.title}
    widthClassName="max-w-md"
  >
    <div className="space-y-3">
      <p className="text-sm text-neutral-200">{confirmation.description}</p>
      <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3">
        <p className="text-sm font-semibold text-amber-200">
          {confirmation.costSummary}
        </p>
        {confirmation.costBreakdown.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-white/70 list-disc list-inside">
            {confirmation.costBreakdown.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={starting}
          className="px-4 py-2 rounded-lg border border-white/20 text-white/80 hover:bg-white/10 disabled:opacity-50 transition-colors text-sm"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={starting}
          className="px-4 py-2 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 border border-amber-400/30 disabled:opacity-50 transition-colors text-sm font-semibold"
        >
          {starting ? 'Starting…' : confirmation.confirmLabel}
        </button>
      </div>
    </div>
  </Modal>
);

export default GenerationConfirmation;
