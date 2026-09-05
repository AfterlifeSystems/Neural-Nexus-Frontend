// src/components/speakerScript.js
//
// Pure helpers for speaker-labelled spoken turns (kept apart from the
// component so Fast Refresh can reload the component alone).

/**
 * Merge consecutive segments of one speaker into single lines.
 *
 * @param {Array<{speaker: string, text: string, is_owner?: boolean}>} segments
 * @returns {Array<{speaker: string, text: string, isOwner: boolean}>}
 */
export function speakerLinesOf(segments) {
  const lines = [];
  for (const segment of segments ?? []) {
    const text = String(segment?.text ?? '').trim();
    if (!text) continue;
    const speaker = String(segment?.speaker ?? '').trim() || 'Speaker';
    const last = lines[lines.length - 1];
    if (last && last.speaker === speaker) {
      last.text = `${last.text} ${text}`;
    } else {
      lines.push({ speaker, text, isOwner: Boolean(segment?.is_owner) });
    }
  }
  return lines;
}

/**
 * Whether a message carries a speaker-labelled transcript worth rendering.
 *
 * @param {Object} message
 * @returns {boolean}
 */
export function hasSpeakerScript(message) {
  return Array.isArray(message?.speakers?.segments) && message.speakers.segments.length > 0;
}
