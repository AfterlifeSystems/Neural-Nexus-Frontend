// What may pull the transcript to its latest turn.
//
// The message list used to scroll on every `messages` identity change.
// A thumb, a feels-real mark, or a metrics attach rewrites the same rows
// and is not a new turn — scrolling then yanks the reader off the bubble
// they just rated. The signature below is the spoken/shown body only.

import { messageKeyOf } from './messageKey.js';

/**
 * A fingerprint of the turns that should stick the view to the end.
 * Ratings, sentiment, usage, and stored ids are left out.
 *
 * @param {Array|null|undefined} messages The open transcript.
 * @returns {string}
 */
export function transcriptScrollSignature(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return '';
  return messages
    .map((message) => {
      const key = messageKeyOf(message) ?? '';
      const body =
        typeof message?.content === 'string'
          ? message.content
          : JSON.stringify(message?.content ?? '');
      const loading = message?.isLoading || message?.isPending ? '1' : '0';
      const stopped = message?.stopped ? '1' : '0';
      const mediaCount = Array.isArray(message?.media) ? message.media.length : 0;
      const chartCount = Array.isArray(message?.charts)
        ? message.charts.length
        : 0;
      const connectionCount = Array.isArray(message?.connections)
        ? message.connections.length
        : 0;
      return [
        key,
        message?.type ?? '',
        loading,
        stopped,
        String(mediaCount),
        String(chartCount),
        String(connectionCount),
        body,
      ].join('\t');
    })
    .join('\n');
}
