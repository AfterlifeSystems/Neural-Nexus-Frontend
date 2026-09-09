// src/services/apiRequestObservers.js
//
// A tiny registry the API client reports every request outcome to, so the
// usage-analytics recorder can log "which endpoints the person's actions
// reached" without wrapping the global fetch. The client calls
// `notifyApiRequest` once per request; observers never throw into the client.

const observers = new Set();

/**
 * Subscribe to API request outcomes.
 *
 * @param {Function} observer Called with `{path, method, status, durationMs,
 *   ok, failed}` after every request the API client makes.
 * @returns {Function} Unsubscribe.
 */
export function observeApiRequests(observer) {
  observers.add(observer);
  return () => observers.delete(observer);
}

/**
 * Report one request outcome to every observer.
 *
 * @param {Object} outcome
 */
export function notifyApiRequest(outcome) {
  for (const observer of observers) {
    try {
      observer(outcome);
    } catch (observerError) {
      console.debug('An API request observer failed:', observerError);
    }
  }
}

/**
 * Strip identifiers out of a request path so events group by endpoint.
 *
 * `/conversations/abc-123/messages` becomes `/conversations/{id}/messages`;
 * a query string is dropped. Kept as a pure function for the tests.
 *
 * @param {string} path
 * @returns {string}
 */
export function endpointOfPath(path) {
  const withoutQuery = String(path ?? '').split('?')[0];
  return withoutQuery
    .split('/')
    .map((segment) =>
      /^[0-9a-f-]{16,}$/i.test(segment) ||
      /^\d+$/.test(segment) ||
      /^(asst|thread|run|auth0\|)/i.test(segment) ||
      (segment.length > 24 && !/^[a-z_]+$/i.test(segment))
        ? '{id}'
        : segment
    )
    .join('/');
}
