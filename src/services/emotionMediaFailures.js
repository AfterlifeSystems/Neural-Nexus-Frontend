// src/services/emotionMediaFailures.js
//
// Why emotion media is missing, in one sentence. The server sends each failed
// still or loop with an `error_code`; `content_moderated` means xAI refused
// the rendered asset after charging for it, so the sentence must not invite a
// blind retry — the same reference image is refused again at the same price.
// Transient vendor failures are retried by re-uploading the reference image:
// that is what starts the emotion portraits and videos again.

export const ERROR_CODE_CONTENT_MODERATED = 'content_moderated';
// The refusal was predicted from the reference image before any call was
// made: nothing rendered, nothing charged. The owner can still choose to
// generate anyway at their own cost.
export const ERROR_CODE_MODERATION_PREDICTED = 'moderation_predicted';
// The xAI team is out of credits or at its spending limit; the run stopped
// after the first refusal and the remaining assets were not attempted.
export const ERROR_CODE_VENDOR_CREDITS_EXHAUSTED = 'vendor_credits_exhausted';
export const ERROR_CODE_NOT_ATTEMPTED = 'not_attempted';

const STILL_KIND = 'still';
const LOOP_KIND = 'idle_loop';

const plural = (count, singular, pluralForm) =>
  `${count} ${count === 1 ? singular : pluralForm}`;

// The direction after a transient miss: a new upload is what rebuilds the
// emotion stills and loops.
export const REUPLOAD_IMAGE_RETRY_DIRECTION = 'Re-upload the image to retry.';

const BLIND_RETRY_SUFFIX = /\s*Retrying is reasonable\.?\s*$/i;

/**
 * Replace leftover "retrying is reasonable" copy with the re-upload direction.
 *
 * The server may still send the old suffix. Settings and the process toast
 * both run the sentence through here so the owner is sent to the portrait.
 *
 * @param {string} [message]
 * @returns {string}
 */
export function preferEmotionMediaReuploadDirection(message) {
  const trimmed = String(message ?? '').trim();
  if (!trimmed) return '';
  if (!BLIND_RETRY_SUFFIX.test(trimmed)) return trimmed;
  const stem = trimmed.replace(BLIND_RETRY_SUFFIX, '').trim();
  return stem
    ? `${stem} ${REUPLOAD_IMAGE_RETRY_DIRECTION}`
    : REUPLOAD_IMAGE_RETRY_DIRECTION;
}

/**
 * Count what failed and whether moderation was the reason.
 *
 * @param {Array<{asset_kind?: string, error_code?: string}>} [failures]
 * @returns {{failedStills: number, failedLoops: number, moderated: number, predicted: number, creditsExhausted: number, total: number}}
 */
export function countEmotionMediaFailures(failures) {
  const rows = Array.isArray(failures) ? failures : [];
  let failedStills = 0;
  let failedLoops = 0;
  let moderated = 0;
  let predicted = 0;
  let creditsExhausted = 0;
  for (const row of rows) {
    if (row?.asset_kind === STILL_KIND) failedStills += 1;
    else if (row?.asset_kind === LOOP_KIND) failedLoops += 1;
    if (row?.error_code === ERROR_CODE_CONTENT_MODERATED) moderated += 1;
    if (row?.error_code === ERROR_CODE_MODERATION_PREDICTED) predicted += 1;
    if (row?.error_code === ERROR_CODE_VENDOR_CREDITS_EXHAUSTED) creditsExhausted += 1;
  }
  return {
    failedStills,
    failedLoops,
    moderated,
    predicted,
    creditsExhausted,
    total: rows.length,
  };
}

/**
 * The sentence to show for a finished generation with failures.
 *
 * Prefers the server's own summary sentence when present, and builds the
 * same shape locally otherwise. Empty when nothing failed.
 *
 * @param {Object} [generation] `{failures, summary}` from a job detail or the
 *   manifest's `last_generation`.
 * @returns {string}
 */
export function emotionMediaFailureMessage(generation) {
  if (!generation) return '';
  const serverMessage = generation?.summary?.message;
  if (typeof serverMessage === 'string' && serverMessage.trim()) {
    return preferEmotionMediaReuploadDirection(serverMessage);
  }
  if (typeof generation?.failure_message === 'string' && generation.failure_message.trim()) {
    return preferEmotionMediaReuploadDirection(generation.failure_message);
  }
  const { failedStills, failedLoops, moderated, predicted, creditsExhausted, total } =
    countEmotionMediaFailures(generation?.failures);
  if (!total) return '';
  if (creditsExhausted > 0) {
    const own = generation.failures.find(
      (row) => row?.error_code === ERROR_CODE_VENDOR_CREDITS_EXHAUSTED && row?.message
    )?.message;
    if (own) return String(own).trim();
    return (
      'xAI refused every generation: the xAI team has used all of its available ' +
      'credits or reached its monthly spending limit. Nothing was generated. Add ' +
      'credits or raise the limit in the xAI console, then generate the missing ' +
      'emotion media from settings.'
    );
  }
  if (predicted === total) {
    const own = generation.failures.find((row) => row?.message)?.message;
    if (own) return String(own).trim();
    return (
      'Emotion media was not generated and nothing was charged: this reference ' +
      "image would be refused by xAI's content moderation after rendering. " +
      'Upload a different reference image (a calm head-and-shoulders portrait ' +
      'with no weapon, no fighting pose, and no franchise character), or ' +
      'choose "generate anyway" to attempt it at your own cost.'
    );
  }
  const parts = [];
  if (failedStills) parts.push(plural(failedStills, 'portrait', 'portraits'));
  if (failedLoops) parts.push(plural(failedLoops, 'emotion video', 'emotion videos'));
  const what = parts.join(' and ');
  if (moderated === total) {
    return (
      `xAI's content moderation refused ${what}. The rendering charge stands, ` +
      'and retrying with the same reference image repeats both the charge and ' +
      'the refusal. Use a different reference image: a calm head-and-shoulders ' +
      'portrait passes far more often than a full-body action pose, a weapon, ' +
      'or a well-known trademarked character.'
    );
  }
  if (moderated) {
    return (
      `${what} could not be generated; xAI's content moderation refused ` +
      `${moderated} of them. Retrying repeats the charge for the refused ones, ` +
      'so consider a calmer, head-and-shoulders reference image.'
    );
  }
  return `${what} could not be generated. ${REUPLOAD_IMAGE_RETRY_DIRECTION}`;
}

/**
 * Whether every failure was a moderation refusal — the case where "try again"
 * only spends money.
 *
 * @param {Object} [generation]
 * @returns {boolean}
 */
export function emotionMediaWasModerated(generation) {
  const { moderated, total } = countEmotionMediaFailures(generation?.failures);
  return total > 0 && moderated === total;
}

/**
 * Whether the run was withheld before any vendor call — the refusal was
 * predicted from the reference image, and nothing was charged. This is the
 * case that offers "generate anyway".
 *
 * @param {Object} [generation]
 * @returns {boolean}
 */
export function emotionMediaWasWithheld(generation) {
  if (generation?.withheld === true) return true;
  const { predicted, total } = countEmotionMediaFailures(generation?.failures);
  return total > 0 && predicted === total;
}
