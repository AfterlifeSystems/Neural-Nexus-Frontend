// src/components/media/SpeakButton.jsx
import React from 'react';
import { Loader2, Square, Volume2 } from 'lucide-react';

/**
 * The speak-aloud control on an assistant message.
 *
 * Presentational: the parent owns the single speech session (see `useSpeech`)
 * so only one message speaks at a time, and this button reflects whether it is
 * the one speaking.
 *
 * @param {Object} parameters
 * @param {boolean} parameters.isSpeaking Whether THIS message is playing.
 * @param {boolean} [parameters.isLoading] Whether its audio is being fetched.
 * @param {Function} parameters.onToggle Start, or stop if speaking.
 */
const SpeakButton = ({ isSpeaking, isLoading = false, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    title={isSpeaking ? 'Stop' : 'Speak aloud'}
    aria-label={isSpeaking ? 'Stop speaking' : 'Speak this message aloud'}
    aria-pressed={isSpeaking}
    className={`p-0.5 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/50 ${
      isSpeaking
        ? 'text-amber-300 bg-amber-400/15'
        : 'text-neutral-400 hover:text-neutral-100 hover:bg-white/10'
    }`}
  >
    {isLoading ? (
      <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
    ) : isSpeaking ? (
      <Square className="w-3 h-3" aria-hidden="true" />
    ) : (
      <Volume2 className="w-3 h-3" aria-hidden="true" />
    )}
  </button>
);

export default SpeakButton;
