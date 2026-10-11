// Turns a FastAPI error body into one readable sentence. Kept apart from
// neuralNexusApiClient.js, which reads Vite environment variables when the
// module loads, so node:test can import the description logic directly.

/**
 * Turn an error body into a single readable sentence.
 *
 * A FastAPI validation failure returns `detail` as an ARRAY of per-field
 * objects rather than a string. Rendering that array directly puts
 * "[object Object]" in front of the user, so each entry is flattened into
 * "field: message" form here.
 *
 * @param {*} errorBody Parsed error response body, or null when unparseable.
 * @param {number} status HTTP status code, used for the fallback message.
 * @returns {string} A human-readable description of the failure.
 */
export function describeErrorBody(errorBody, status) {
  const detail = errorBody?.detail;
  if (typeof detail === 'string') {
    return detail;
  }
  // An upload whose every item was rejected answers with
  // { message, rejected: [{ filename, reason }] }; the per-item reason is
  // what tells the person why the link or file could not be read.
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const rejectedItems = Array.isArray(detail.rejected) ? detail.rejected : [];
    const rejectedReasons = rejectedItems
      .filter((rejectedItem) => rejectedItem?.reason)
      .map((rejectedItem) =>
        rejectedItem.filename
          ? `${rejectedItem.filename}: ${rejectedItem.reason}`
          : rejectedItem.reason,
      );
    if (rejectedReasons.length > 0) {
      return rejectedReasons.join('; ');
    }
    if (typeof detail.message === 'string' && detail.message) {
      return detail.message;
    }
  }
  if (Array.isArray(detail)) {
    return detail
      .map((validationError) => {
        const fieldPath = Array.isArray(validationError.loc)
          ? validationError.loc
              .filter((pathSegment) => pathSegment !== 'body')
              .join('.')
          : '';
        return fieldPath
          ? `${fieldPath}: ${validationError.msg}`
          : validationError.msg;
      })
      .join('; ');
  }
  if (typeof errorBody === 'string' && errorBody) {
    return errorBody;
  }
  return `Request failed (${status})`;
}
