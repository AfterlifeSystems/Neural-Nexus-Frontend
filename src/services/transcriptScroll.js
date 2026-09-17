// What may pull the transcript to its latest turn.
//
// The message list used to scroll on every `messages` identity change.
// A thumb, a feels-real mark, or a metrics attach rewrites the same rows
// and is not a new turn — scrolling then yanks the reader off the bubble
// they just rated. The signature below is the spoken/shown body only.
//
// Speak playback also moves the view to the row being read aloud. That scroll
// must stay inside the transcript's own box — `scrollIntoView` walks every
// scrollable ancestor, including a parent frame on the landing-page demo.

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

/**
 * Which transcript row should come into view for the current Speak session.
 * Live-stage reply audio maps onto the last completed avatar turn; composer
 * draft playback has no row.
 *
 * @param {string|null|undefined} speakingKey The active Speak key.
 * @param {string|null|undefined} lastCompletedAvatarMessageKey Message key of
 *   the latest finished avatar turn, used when speakingKey is `live-reply`.
 * @returns {string|null}
 */
export function speakingTranscriptMessageKey(
  speakingKey,
  lastCompletedAvatarMessageKey
) {
  if (!speakingKey || speakingKey === 'composer-draft') return null;
  if (speakingKey === 'live-reply') {
    return lastCompletedAvatarMessageKey ?? null;
  }
  return speakingKey;
}

/**
 * The scrolling box a descendant actually scrolls inside: the nearest ancestor
 * whose own overflow is scrollable, or the document itself when no element in
 * the chain scrolls. Deliberately stops at this document — a parent frame's
 * scroll position belongs to the page doing the embedding, not to the chat.
 *
 * @param {Element} descendantElement The element to scroll into view.
 * @returns {Element|null} The box to scroll, or null when there is none.
 */
export function findNearestScrollingAncestor(descendantElement) {
  if (!descendantElement) return null;
  let candidate = descendantElement.parentElement;
  while (candidate) {
    const { overflowY } = window.getComputedStyle(candidate);
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      candidate.scrollHeight > candidate.clientHeight
    ) {
      return candidate;
    }
    candidate = candidate.parentElement;
  }
  return descendantElement.ownerDocument?.scrollingElement ?? null;
}

/**
 * Scroll a descendant into view inside the nearest scrolling ancestor only.
 * Same intent as `scrollIntoView({ block: 'nearest' })`, without walking up
 * through a parent frame.
 *
 * @param {Element} descendantElement The element that should become visible.
 * @param {{ behavior?: ScrollBehavior }} [options]
 * @returns {boolean} Whether a scroll was started.
 */
export function scrollElementIntoNearestScroller(
  descendantElement,
  { behavior = 'smooth' } = {}
) {
  if (!descendantElement) return false;
  const transcriptScrollBox = findNearestScrollingAncestor(descendantElement);
  if (!transcriptScrollBox) return false;

  const descendantRect = descendantElement.getBoundingClientRect();
  const scrollBoxIsDocument =
    transcriptScrollBox ===
    descendantElement.ownerDocument?.scrollingElement;
  const visibleTop = scrollBoxIsDocument
    ? 0
    : transcriptScrollBox.getBoundingClientRect().top;
  const visibleBottom = scrollBoxIsDocument
    ? window.innerHeight
    : transcriptScrollBox.getBoundingClientRect().bottom;

  let deltaY = 0;
  if (descendantRect.top < visibleTop) {
    deltaY = descendantRect.top - visibleTop;
  } else if (descendantRect.bottom > visibleBottom) {
    deltaY = descendantRect.bottom - visibleBottom;
  }
  if (deltaY === 0) return false;

  if (typeof transcriptScrollBox.scrollBy === 'function') {
    transcriptScrollBox.scrollBy({ top: deltaY, behavior });
  } else {
    transcriptScrollBox.scrollTop += deltaY;
  }
  return true;
}
