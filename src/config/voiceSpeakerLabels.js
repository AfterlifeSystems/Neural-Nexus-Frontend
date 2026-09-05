// src/config/voiceSpeakerLabels.js
//
// Whether "who is speaking" (speaker-labelled live-voice turns) starts on for
// a personal avatar before the person has ever toggled it. The person's own
// choice, kept in the voice-mode preferences, wins afterwards.

/**
 * @returns {boolean}
 */
export function speakerLabelsDefaultOn() {
  const raw = String(import.meta.env.VITE_VOICE_SPEAKER_LABELS_DEFAULT ?? 'true')
    .trim()
    .toLowerCase();
  return !['0', 'false', 'off', 'no'].includes(raw);
}
