// src/config/voiceSpeakerLabels.js
//
// Whether live-voice turns on a personal avatar are labelled by speaker (the
// owner by voice, others as Speaker N). There is no control for this in voice
// mode: telling the owner from other people in the room is how the avatar is
// meant to hear, not a preference to weigh up, so the deployment decides.

/**
 * @returns {boolean}
 */
export function speakerLabelsDefaultOn() {
  const raw = String(import.meta.env.VITE_VOICE_SPEAKER_LABELS_DEFAULT ?? 'true')
    .trim()
    .toLowerCase();
  return !['0', 'false', 'off', 'no'].includes(raw);
}
