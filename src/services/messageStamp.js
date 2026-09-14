// The date and time shown on a transcript row.
//
// New turns write `timestamp` as ISO. Reopened threads may only have
// `created_at` (or the same instant nested under kwargs / response
// metadata). The stamp reads every one of those so a loaded conversation
// is dated the same way a live send is.

/**
 * The instant a transcript row was written, if the row recorded one.
 *
 * @param {Object|null|undefined} message A human or avatar turn.
 * @returns {string|number|Date|null}
 */
export function messageStampValueOf(message) {
  if (!message || typeof message !== 'object') return null;
  return (
    message.timestamp ??
    message.created_at ??
    message.additional_kwargs?.created_at ??
    message.response_metadata?.created_at ??
    null
  );
}

/**
 * Parse a stamp value into a Date, or null when it is missing or invalid.
 *
 * @param {string|number|Date|null|undefined} value
 * @returns {Date|null}
 */
export function parseMessageStampDate(value) {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Human-readable date and time for a transcript row.
 *
 * Same calendar year as `now` omits the year so today's thread stays short.
 * An older year keeps the year so a reopened archive is unambiguous.
 *
 * @param {string|number|Date|null|undefined} value
 * @param {Object} [options]
 * @param {Date} [options.now]
 * @param {string} [options.locale]
 * @returns {string} Empty when the value cannot be parsed.
 */
export function formatMessageStamp(value, { now = new Date(), locale } = {}) {
  const date = parseMessageStampDate(value);
  if (!date) return '';
  const includeYear = date.getFullYear() !== now.getFullYear();
  const datePart = date.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' } : {}),
  });
  const timePart = date.toLocaleTimeString(locale, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${datePart}, ${timePart}`;
}

/**
 * The machine-readable instant for a `<time dateTime>` attribute.
 *
 * @param {string|number|Date|null|undefined} value
 * @returns {string} Empty when the value cannot be parsed.
 */
export function messageStampDateTime(value) {
  const date = parseMessageStampDate(value);
  return date ? date.toISOString() : '';
}
