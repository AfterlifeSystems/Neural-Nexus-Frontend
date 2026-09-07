// src/services/connectionOauthPopup.js
//
// The popup half of connecting an account: a Google sign-in, a Plaid Link
// window, or a browser session on a site's own login page. The card opens a
// blank window in the click handler, asks the API where the window should go,
// and then waits for one of two signals — the window posting a login result
// back, or the account showing up in the connections list.
//
// Everything here is free of the API client and of React, so the rules the
// card relies on — which origin a result may come from, which nonce a result
// must carry, when a poll gives up — can be tested on their own.

/** The `type` of the message the popup posts back to the opener. */
export const LOGIN_RESULT_MESSAGE_TYPE = 'neural-nexus:login-result';

const DEFAULT_POPUP_WIDTH = 540;
const DEFAULT_POPUP_HEIGHT = 720;
const DEFAULT_POLL_INTERVAL_MS = 2_000;
const DEFAULT_POLL_TIMEOUT_MS = 5 * 60 * 1_000;

/**
 * Open a blank popup window right now, before any request is made.
 *
 * Popup blockers allow a window only when the call happens inside the click
 * that asked for one. The login endpoint is asked afterwards and the window is
 * navigated once the endpoint answers (see `navigatePopup`). Null means the
 * browser refused, and the caller should show a link instead.
 *
 * @param {string} name The window name, reused so a second press focuses the
 *   same window instead of opening another.
 * @param {Object} [options]
 * @param {number} [options.width]
 * @param {number} [options.height]
 * @returns {Window|null} The window, or null when blocked or headless.
 */
export function openPopupSynchronously(name, options = {}) {
  if (typeof window === 'undefined' || typeof window.open !== 'function') {
    return null;
  }
  const width = options.width ?? DEFAULT_POPUP_WIDTH;
  const height = options.height ?? DEFAULT_POPUP_HEIGHT;
  const screenLeft = window.screenX ?? window.screenLeft ?? 0;
  const screenTop = window.screenY ?? window.screenTop ?? 0;
  const viewportWidth = window.outerWidth ?? window.innerWidth ?? width;
  const viewportHeight = window.outerHeight ?? window.innerHeight ?? height;
  const left = Math.max(0, Math.round(screenLeft + (viewportWidth - width) / 2));
  const top = Math.max(0, Math.round(screenTop + (viewportHeight - height) / 2));
  const features = [
    'popup=yes',
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
    'resizable=yes',
    'scrollbars=yes',
  ].join(',');
  try {
    return window.open('about:blank', name, features);
  } catch {
    return null;
  }
}

/**
 * Send an already-open popup to the login page.
 *
 * @param {Window|null} popup The window from `openPopupSynchronously`.
 * @param {string} url Where the window should go.
 * @returns {boolean} Whether the window could be navigated.
 */
export function navigatePopup(popup, url) {
  if (!popup || !url) return false;
  try {
    popup.location.href = url;
    popup.focus?.();
    return true;
  } catch {
    return false;
  }
}

/**
 * Close a popup the card opened, ignoring a window that already closed.
 *
 * @param {Window|null} popup
 */
export function closePopup(popup) {
  try {
    if (popup && !popup.closed) popup.close();
  } catch {
    // The window may belong to another origin by now; closing is best effort.
  }
}

/**
 * The origin (`scheme://host[:port]`) of the API base URL.
 *
 * The popup ends on an API page that posts the login result back, so the
 * result is trusted only when the message comes from this origin.
 *
 * @param {string} baseUrl The API base URL.
 * @returns {string} The origin, or an empty string when the URL is unusable.
 */
export function apiOriginOf(baseUrl) {
  if (!baseUrl) return '';
  try {
    return new URL(baseUrl).origin;
  } catch {
    return '';
  }
}

/**
 * Make a login endpoint's answer absolute.
 *
 * `/connect_account/oauth/start` answers with a full authorization URL, while
 * the Plaid and browser-session endpoints answer with a PATH on the API
 * origin. Both are accepted here.
 *
 * @param {string} pathOrUrl A full URL or a path on the API.
 * @param {string} baseUrl The API base URL.
 * @returns {string} An absolute URL, or an empty string for no input.
 */
export function absoluteApiUrl(pathOrUrl, baseUrl) {
  const value = String(pathOrUrl ?? '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  const base = String(baseUrl ?? '').replace(/\/+$/, '');
  const path = value.startsWith('/') ? value : `/${value}`;
  return `${base}${path}`;
}

/**
 * The login result a `message` event carries, when the event is the one the
 * card is waiting for.
 *
 * A result is accepted only when the message comes from the API's origin and
 * names the nonce this login was started with. Anything else — a message from
 * another origin, a stale result from an earlier attempt, an unrelated
 * message on the window — is ignored.
 *
 * @param {MessageEvent} event The `message` event.
 * @param {Object} expectations
 * @param {string} expectations.expectedOrigin The API origin.
 * @param {string} expectations.nonce The nonce the login was started with.
 * @returns {Object|null} The result `{ok, nonce, provider, account_key, ...}`
 *   or null when the event is not this login's result.
 */
export function parseLoginResultMessage(event, { expectedOrigin, nonce }) {
  if (!event || !expectedOrigin || !nonce) return null;
  if (event.origin !== expectedOrigin) return null;
  const data = event.data;
  if (!data || typeof data !== 'object') return null;
  if (data.type !== LOGIN_RESULT_MESSAGE_TYPE) return null;
  if (String(data.nonce ?? '') !== String(nonce)) return null;
  return data;
}

const defaultSleep = (milliseconds, signal) =>
  new Promise((resolve) => {
    const timer = setTimeout(finish, milliseconds);
    function finish() {
      signal?.removeEventListener?.('abort', finish);
      clearTimeout(timer);
      resolve();
    }
    signal?.addEventListener?.('abort', finish, { once: true });
  });

/**
 * Poll the connections list until a matching row appears.
 *
 * The second way a popup login is noticed. A popup whose opener was blocked,
 * or that the browser opened in a tab, can never post a result back; the
 * account still exists on the API once the sign-in finishes, so the card asks
 * every couple of seconds whether a row for the provider has appeared.
 *
 * @param {Object} parameters
 * @param {Function} parameters.listConnections Resolves to the connection rows.
 * @param {Function} parameters.matches Given one row, whether the row is the
 *   account being waited for.
 * @param {number} [parameters.intervalMs] Delay between polls.
 * @param {number} [parameters.timeoutMs] When to give up.
 * @param {Function} [parameters.sleep] `(milliseconds, signal) => Promise`,
 *   replaceable in tests.
 * @param {AbortSignal} [parameters.signal] Stops the poll early.
 * @param {Function} [parameters.now] Clock, replaceable in tests.
 * @returns {Promise<Object|null>} The matching row, or null when the poll
 *   timed out or was aborted.
 */
export async function pollUntilConnected({
  listConnections,
  matches,
  intervalMs = DEFAULT_POLL_INTERVAL_MS,
  timeoutMs = DEFAULT_POLL_TIMEOUT_MS,
  sleep = defaultSleep,
  signal = null,
  now = () => Date.now(),
}) {
  const startedAt = now();
  while (!signal?.aborted) {
    try {
      const rows = await listConnections();
      const list = Array.isArray(rows) ? rows : (rows?.connections ?? []);
      const found = list.find((row) => matches(row));
      if (found) return found;
    } catch {
      // A failed listing is not a failed login; the next poll asks again.
    }
    if (signal?.aborted) return null;
    if (now() - startedAt >= timeoutMs) return null;
    await sleep(intervalMs, signal);
  }
  return null;
}

/**
 * The account key a connections row is stored under, without the `account:`
 * prefix the row's `connection_key` carries.
 *
 * @param {Object} row A `listConnections` row.
 * @returns {string} The account key, or an empty string.
 */
export function accountKeyOfRow(row) {
  if (!row) return '';
  if (row.account_key) return String(row.account_key);
  const connectionKey = String(row.connection_key ?? '');
  return connectionKey.startsWith('account:')
    ? connectionKey.slice('account:'.length)
    : connectionKey;
}

/**
 * Whether a connections row is the account a login is waiting for.
 *
 * When the login result named an account key, only that row counts. Before
 * one is known, any connected row for the provider that was NOT already there
 * when the login started counts — that is the account the sign-in created.
 *
 * @param {Object} row A `listConnections` row.
 * @param {Object} expectations
 * @param {string} expectations.provider The provider being connected.
 * @param {string} [expectations.accountKey] The key from the login result.
 * @param {Set<string>|string[]} [expectations.knownAccountKeys] Keys that
 *   existed before the login started.
 * @returns {boolean}
 */
export function rowMatchesLogin(
  row,
  { provider, accountKey = null, knownAccountKeys = [] }
) {
  if (!row || row.provider !== provider) return false;
  if (!row.connected && row.status !== 'connected') return false;
  const rowKey = accountKeyOfRow(row);
  if (accountKey) return rowKey === String(accountKey);
  const known = new Set(Array.from(knownAccountKeys ?? []).map(String));
  return !known.has(rowKey);
}
