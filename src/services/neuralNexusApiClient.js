// src/services/neuralNexusApiClient.js
//
// The single point of contact between this application and the Neural Nexus
// API (see api-1.json in the repository root). Nothing else in the source tree
// calls fetch against the backend, holds the credential, or knows the base URL.
//
// Authentication: every authenticated endpoint accepts either an `API-KEY`
// header or `Authorization: Bearer <token>`. This application uses the bearer
// form with the `refresh_token` returned by POST /login, because the API shows an
// account's API key exactly once — at signup — and a browser is not where that
// key should live. The key is shown to the user to save for their integrations;
// the session here runs on the refresh token. The bearer value is treated as
// opaque everywhere except `extractSessionCredentialFromLoginResponse`, so if the
// API ever expects a different token from the login response, only that one
// function changes.

export const NEURAL_NEXUS_API_BASE_URL =
  import.meta.env.VITE_NEURAL_NEXUS_API_BASE_URL ?? 'http://localhost:8080';

const SESSION_CREDENTIAL_STORAGE_KEY = 'neural_nexus_session_credential';

export function getSessionCredential() {
  return localStorage.getItem(SESSION_CREDENTIAL_STORAGE_KEY);
}

export function setSessionCredential(sessionCredential) {
  localStorage.setItem(SESSION_CREDENTIAL_STORAGE_KEY, sessionCredential);
}

export function clearSessionCredential() {
  localStorage.removeItem(SESSION_CREDENTIAL_STORAGE_KEY);
}

/**
 * Extract the credential this application authenticates with from a POST /login
 * response body.
 *
 * The login response carries `access_token`, `id_token`, `refresh_token`, and
 * `expires_in`. The refresh token is used as the bearer credential because the
 * refresh token outlives the access token, so a session survives longer than
 * `expires_in` without a renewal path in the client. This function is the ONLY
 * place that choice is expressed.
 *
 * @param {Object} loginResponse Parsed body of POST /login.
 * @returns {string} The bearer credential to store and send.
 */
export function extractSessionCredentialFromLoginResponse(loginResponse) {
  return loginResponse.refresh_token;
}

/**
 * Build the Authorization header for the current session.
 *
 * Returning an empty object is a valid, expected state, not an error: the API
 * resolves an anonymous identity for callers with no credential, which is how
 * GET /list_public_avatars and POST /message/{assistant_id} serve visitors who
 * have not signed in.
 *
 * @returns {Object} Either `{Authorization}` or an empty object.
 */
export function buildAuthenticationHeaders() {
  const sessionCredential = getSessionCredential();
  return sessionCredential
    ? { Authorization: `Bearer ${sessionCredential}` }
    : {};
}

export class ApiError extends Error {
  constructor(status, detail) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
  }
}

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
function describeErrorBody(errorBody, status) {
  const detail = errorBody?.detail;
  if (typeof detail === 'string') {
    return detail;
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

/**
 * Append query parameters to a path, skipping anything the caller left unset.
 *
 * Most of this API's write endpoints take their arguments as query parameters
 * rather than a JSON body, and most of those parameters are optional. Sending
 * `?description=undefined` would store the literal string "undefined", so
 * undefined and null values are dropped rather than serialized.
 *
 * @param {string} path The endpoint path.
 * @param {Object} [query] Parameter names mapped to values.
 * @returns {string} The path with a query string appended when non-empty.
 */
function appendQueryParameters(path, query) {
  if (!query) {
    return path;
  }
  const searchParameters = new URLSearchParams();
  for (const [parameterName, parameterValue] of Object.entries(query)) {
    if (parameterValue === undefined || parameterValue === null) {
      continue;
    }
    searchParameters.append(parameterName, String(parameterValue));
  }
  const queryString = searchParameters.toString();
  return queryString ? `${path}?${queryString}` : path;
}

/**
 * Handle a response the API rejected: throw an ApiError carrying the API's
 * own description of the failure.
 *
 * @param {Response} response The non-ok fetch response.
 * @param {boolean} sessionCredentialWasSent Whether this request carried the bearer header.
 */
async function raiseApiError(response, sessionCredentialWasSent) {
  let errorBody = null;
  try {
    errorBody = await response.json();
  } catch {
    // A non-JSON error body (a proxy error page, an empty response) still
    // needs to produce an ApiError; describeErrorBody falls back to the
    // status code.
  }
  const description = describeErrorBody(errorBody, response.status);

  // An account that has not verified its email yet is rejected with 401 by every
  // endpoint that requires verification, even though its session is perfectly
  // good. That is the expected state for the whole stretch between signing up
  // and following the link in the email — the sign-up screen polls through it —
  // so the session must survive it. Every OTHER 401 while holding a credential
  // means the session itself is gone (revoked by a logout elsewhere, or
  // expired), and dropping it lets the next render fall through to the login
  // screen instead of retrying forever with a credential the API keeps refusing.
  if (
    response.status === 401 &&
    sessionCredentialWasSent &&
    !isEmailNotVerifiedDescription(description)
  ) {
    clearSessionCredential();
  }

  throw new ApiError(response.status, description);
}

/**
 * Recognize the API's "verify your email first" rejection.
 *
 * The API expresses this as a 401 carrying the sentence
 * "Email is not yet verified. Please verify email to continue.", with no
 * machine-readable error code to key on, so the text is matched instead.
 *
 * @param {string} description The flattened error description.
 * @returns {boolean} True when the rejection is about email verification.
 */
export function isEmailNotVerifiedDescription(description) {
  return /email is not.*verified/i.test(description ?? '');
}

/**
 * Issue a request to the Neural Nexus API and parse the response.
 *
 * `credentials: 'include'` is set on every request because POST /login also
 * sets the refresh token as an httpOnly cookie, and POST /logout reads that
 * cookie before the request body. The cookie only travels when the API's
 * cross-origin configuration permits credentialed requests from this origin;
 * the bearer header works either way, and logout carries an explicit body as
 * the documented fallback.
 *
 * @param {string} path Endpoint path, e.g. '/list_user_avatars'.
 * @param {Object} [options]
 * @param {string} [options.method] HTTP method, defaults to GET.
 * @param {Object} [options.query] Query parameters.
 * @param {Object} [options.body] A value to send as a JSON body.
 * @param {FormData} [options.formData] A multipart body; mutually exclusive with `body`.
 * @param {AbortSignal} [options.signal] Cancellation signal.
 * @returns {Promise<*>} The parsed response body, or undefined for an empty one.
 */
export async function requestJson(path, options = {}) {
  const { method = 'GET', query, body, formData, signal } = options;

  const headers = buildAuthenticationHeaders();
  const sessionCredentialWasSent = 'Authorization' in headers;

  // FormData must set its own Content-Type so the browser can generate the
  // multipart boundary; declaring a Content-Type here would corrupt the
  // request.
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(
    `${NEURAL_NEXUS_API_BASE_URL}${appendQueryParameters(path, query)}`,
    {
      method,
      headers,
      credentials: 'include',
      body: formData ?? (body === undefined ? undefined : JSON.stringify(body)),
      signal,
    }
  );

  if (!response.ok) {
    await raiseApiError(response, sessionCredentialWasSent);
  }

  if (response.status === 204) {
    return undefined;
  }

  // A response the server did not label as JSON (or an empty 202 body) must
  // not blow up the caller with a parse error.
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    const responseText = await response.text();
    return responseText || undefined;
  }
  return response.json();
}

/**
 * Consume a server-sent event stream from the API, invoking `onEvent` for
 * every parsed frame.
 *
 * `EventSource` cannot be used for these streams: EventSource only issues GET
 * requests, cannot carry a multipart body, and cannot set an Authorization
 * header. So the stream is read directly off the fetch response body.
 *
 * Frames are separated by a blank line. Lines beginning with ':' are
 * server-sent-event comments — the API emits ": keepalive" while running
 * post-reply analysis that produces no tokens, purely to reset the client's
 * idle-read timer — and are discarded. Every other frame arrives as a
 * `data: ` line holding one JSON object whose `type` field identifies the
 * event (`usage_estimate`, `assistant_token`, `done`, `interrupt`,
 * `media_progress`, `status`, `keep_alive`, ...).
 *
 * @param {string} path Endpoint path.
 * @param {Object} [options]
 * @param {string} [options.method] HTTP method, defaults to POST.
 * @param {Object} [options.query] Query parameters.
 * @param {FormData} [options.formData] Request body, when the method takes one.
 * @param {Function} [options.onEvent] Called with every parsed frame object.
 * @param {AbortSignal} [options.signal] Cancellation signal.
 */
export async function streamServerSentEvents(path, options = {}) {
  const { method = 'POST', query, formData, onEvent, signal } = options;

  const headers = buildAuthenticationHeaders();
  const sessionCredentialWasSent = 'Authorization' in headers;
  headers.Accept = 'text/event-stream';

  const response = await fetch(
    `${NEURAL_NEXUS_API_BASE_URL}${appendQueryParameters(path, query)}`,
    { method, headers, credentials: 'include', body: formData, signal }
  );

  if (!response.ok) {
    await raiseApiError(response, sessionCredentialWasSent);
  }
  if (!response.body) {
    throw new ApiError(response.status, 'The server returned no event stream.');
  }

  const reader = response.body.getReader();
  const textDecoder = new TextDecoder();
  // A network chunk can split a frame anywhere, including mid-character, so
  // partial text is carried across reads rather than parsed in isolation.
  let pendingText = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      pendingText += textDecoder.decode(value, { stream: true });

      let frameBoundary = pendingText.indexOf('\n\n');
      while (frameBoundary !== -1) {
        const frame = pendingText.slice(0, frameBoundary);
        pendingText = pendingText.slice(frameBoundary + 2);
        dispatchServerSentEventFrame(frame, onEvent);
        frameBoundary = pendingText.indexOf('\n\n');
      }
    }
    // A stream that ends without a trailing blank line still owes the caller
    // whatever complete frame remains in the buffer.
    if (pendingText.trim()) {
      dispatchServerSentEventFrame(pendingText, onEvent);
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Parse one server-sent-event frame and hand each `data:` payload to the
 * caller's handler.
 *
 * @param {string} frame The frame text, without the trailing blank line.
 * @param {Function} [onEvent] Handler for parsed payload objects.
 */
function dispatchServerSentEventFrame(frame, onEvent) {
  for (const line of frame.split('\n')) {
    if (!line.startsWith('data:')) {
      // A comment line is the server saying "still here" during a stretch that
      // produces no tokens — the API emits ": keepalive" every few seconds
      // while it runs post-reply analysis. That is the only evidence a client
      // has that a silent turn is alive rather than stalled, so it is reported
      // as a synthetic event rather than dropped. Other server-sent-event
      // fields this API does not use (event:, id:, retry:) are ignored.
      if (line.startsWith(':')) {
        onEvent?.({ type: 'keepalive_comment', text: line.slice(1).trim() });
      }
      continue;
    }
    const payloadText = line.slice('data:'.length).trim();
    if (!payloadText) {
      continue;
    }
    try {
      onEvent?.(JSON.parse(payloadText));
    } catch {
      // A single malformed frame must never tear down a stream that is
      // otherwise delivering tokens.
    }
  }
}
