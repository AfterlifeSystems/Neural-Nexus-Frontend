// Live voice can close a turn while the last one is still being transcribed.
// Those files wait here so only one /transcribe (or speaker-labelled send)
// is in flight — overlapping calls are what trip the API's 429.

export const MAX_QUEUED_LIVE_UTTERANCES = 2;

/**
 * Append an utterance, dropping the oldest when the queue is full so the
 * person is not waiting on speech they have already moved past.
 *
 * @param {File[]} queue
 * @param {File} file
 * @param {number} [max]
 * @returns {File[]}
 */
export function enqueueLiveUtterance(
  queue,
  file,
  max = MAX_QUEUED_LIVE_UTTERANCES
) {
  const next = [...(queue ?? []), file];
  if (next.length <= max) return next;
  return next.slice(next.length - max);
}
