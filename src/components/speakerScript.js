// src/components/speakerScript.js
//
// Pure helpers for speaker-labelled spoken turns (kept apart from the
// component so Fast Refresh can reload the component alone).

/**
 * Merge consecutive segments of one speaker into single lines.
 *
 * @param {Array<{speaker: string, text: string, is_owner?: boolean}>} segments
 * @returns {Array<{speaker: string, text: string, isOwner: boolean, isAvatar: boolean}>}
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
      lines.push({
        speaker,
        text,
        isOwner: Boolean(segment?.is_owner),
        isAvatar: Boolean(segment?.is_avatar),
      });
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

/**
 * Plain text for edit / copy / retry. Stored turns are strings; a live
 * spoken turn may carry LangChain content blocks or only speaker segments.
 *
 * @param {Object} [message]
 * @returns {string}
 */
export function editableScriptText(message) {
  const fromContent = contentAsPlainText(message?.content);
  if (fromContent.trim()) return fromContent;
  if (hasSpeakerScript(message)) {
    return speakerLinesOf(message.speakers.segments)
      .map((line) => line.text)
      .join('\n');
  }
  return fromContent;
}

function contentAsPlainText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part) => {
      if (typeof part === 'string') return part;
      if (part && typeof part === 'object' && typeof part.text === 'string') {
        return part.text;
      }
      return '';
    })
    .join('');
}
