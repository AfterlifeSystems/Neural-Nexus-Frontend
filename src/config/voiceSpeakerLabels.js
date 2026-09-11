// src/config/voiceSpeakerLabels.js
//
// Whether overheard voices in the room are split onto their own bubbles
// (a stable animal-and-colour identity each, like anonymous guests in a
// shared Google Doc). The signed-in person and this avatar are already named
// by the bubble, so they stay unlabelled. There is no control for this in
// voice mode: telling those other people apart is how the avatar is meant to
// hear, not a preference to weigh up, so the deployment decides. Shared /
// anonymous chats stay unlabelled: there is no stored voice to recognise.

/**
 * @returns {boolean}
 */
export function speakerLabelsDefaultOn() {
  const raw = String(import.meta.env.VITE_VOICE_SPEAKER_LABELS_DEFAULT ?? 'true')
    .trim()
    .toLowerCase();
  return !['0', 'false', 'off', 'no'].includes(raw);
}
