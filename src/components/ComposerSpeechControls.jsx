// src/components/ComposerSpeechControls.jsx
import React from 'react';
import { Loader2, Mic, Square, Volume2 } from 'lucide-react';

const DEFAULT_BUTTON_CLASSES =
  'p-1.5 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:opacity-40 disabled:pointer-events-none';

/**
 * Play the draft in the person's voice without sending, and — where the
 * composer wants it — dictate into the box. The chat message area is
 * text-to-speech only; voice mode's composer offers both.
 *
 * @param {Object} parameters
 * @param {boolean} [parameters.showDictation] Offer the speech-to-text button.
 * @param {boolean} [parameters.canDictate]
 * @param {boolean} parameters.canPlayDraft
 * @param {boolean} [parameters.isDictating]
 * @param {boolean} [parameters.isTranscribing]
 * @param {boolean} parameters.isPlayingDraft
 * @param {boolean} parameters.isPlayLoading
 * @param {boolean} [parameters.hasDraft]
 * @param {string} [parameters.unavailableMessage]
 * @param {Function} [parameters.onToggleDictation]
 * @param {Function} parameters.onTogglePlay
 * @param {string} [parameters.buttonClassName]
 * @param {string} [parameters.dictatingClassName]
 * @param {string} [parameters.playingClassName]
 */
export default function ComposerSpeechControls({
  showDictation = true,
  canDictate = false,
  canPlayDraft,
  isDictating = false,
  isTranscribing = false,
  isPlayingDraft,
  isPlayLoading,
  hasDraft = false,
  unavailableMessage,
  onToggleDictation,
  onTogglePlay,
  buttonClassName = DEFAULT_BUTTON_CLASSES,
  dictatingClassName = 'bg-red-500/30 text-red-200',
  playingClassName = 'text-amber-300 bg-amber-400/15',
}) {
  return (
    <>
      {showDictation && (
        <button
          type="button"
          disabled={!canDictate}
          onClick={onToggleDictation}
          title={
            !canDictate
              ? unavailableMessage
              : isDictating
                ? 'Stop recording — the words appear in the box'
                : 'Speech to text — record without sending'
          }
          aria-label={
            !canDictate
              ? 'Speech input unavailable'
              : isDictating
                ? 'Stop recording'
                : 'Speech to text'
          }
          aria-pressed={isDictating}
          className={`${buttonClassName} ${isDictating ? dictatingClassName : ''}`}
        >
          {isDictating ? (
            <Square className="w-5 h-5 fill-current" />
          ) : isTranscribing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Mic className="w-5 h-5" />
          )}
        </button>
      )}
      <button
        type="button"
        disabled={!canPlayDraft || (!hasDraft && !isPlayingDraft)}
        onClick={onTogglePlay}
        title={
          isPlayingDraft
            ? 'Stop'
            : 'Play in your voice without sending'
        }
        aria-label={
          isPlayingDraft
            ? 'Stop playing'
            : 'Play in your voice without sending'
        }
        aria-pressed={isPlayingDraft}
        className={`${buttonClassName} ${isPlayingDraft ? playingClassName : ''}`}
      >
        {isPlayLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : isPlayingDraft ? (
          <Square className="w-5 h-5" />
        ) : (
          <Volume2 className="w-5 h-5" />
        )}
      </button>
    </>
  );
}
