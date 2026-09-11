// src/services/ownBrowserSignIn.js
/**
 * Signing in to a site in the owner's OWN browser, not in a hosted window.
 *
 * When a machine of the owner's is running the Neural Nexus connector, the
 * API opens a site's sign-in page as a tab in the browser they actually use —
 * the browser the vendor already trusts, and the one they are frequently
 * signed in to already. Strict vendors (Google above all) refuse an automated
 * browser outright, so this is the path that works for them.
 *
 * `POST /connect_account/browser/start` decides which browser is used and says
 * so in its answer, which means a card that asked for a hosted window can be
 * answered with the owner's own browser instead. The functions here read that
 * answer and shape what the card holds, kept out of the component so the
 * decisions are testable on their own.
 */

/** The `login_mode` the API answers with when it used the owner's own browser. */
export const OWN_BROWSER_LOGIN_MODE = 'desktop_browser';

/** The `login_mode` of the window this API hosts and streams into a popup. */
export const HOSTED_BROWSER_LOGIN_MODE = 'browser_session';

/**
 * Whether a start answer means the page opened in the owner's own browser.
 *
 * @param {Object} started The answer from the login endpoint.
 * @returns {boolean}
 */
export function startedInOwnBrowser(started) {
  return started?.login_mode === OWN_BROWSER_LOGIN_MODE;
}

/**
 * What the card holds while the owner signs in on their own screen.
 *
 * @param {Object} started The answer from the login endpoint.
 * @param {Object} [origin] Where the sign-in came from, so "sign in here
 *   instead" can start again against the same endpoint.
 * @param {string} [origin.loginEndpoint]
 * @param {Object} [origin.loginRequest]
 * @returns {Object|null} The login to hold, or `null` when the answer was not
 *   an own-browser sign-in.
 */
export function ownBrowserLoginFromStart(started, origin = {}) {
  if (!startedInOwnBrowser(started) || !started?.login_id) return null;
  return {
    login_id: started.login_id,
    login_token: started.login_token ?? '',
    device_label: started.device_label ?? '',
    site_hostname: started.site_hostname ?? '',
    site_url: started.site_url ?? '',
    instructions: started.instructions ?? '',
    login_endpoint: origin.loginEndpoint ?? '/connect_account/browser/start',
    login_request: origin.loginRequest ?? {},
  };
}

/**
 * The line telling the owner where the page opened.
 *
 * The API writes this sentence, because it is the side that knows which
 * machine answered; this is the fallback for an older API that did not.
 *
 * @param {Object} login The held own-browser login.
 * @returns {string}
 */
export function ownBrowserInstructions(login) {
  if (login?.instructions) return login.instructions;
  const site = login?.site_hostname || 'The sign-in page';
  const machine = login?.device_label || 'your machine';
  return `${site} is open in your browser on ${machine}. Sign in there, then say you are done.`;
}

/**
 * The request that starts the same sign-in over again in a hosted window.
 *
 * Used when the owner is not at the machine the tab opened on.
 *
 * @param {Object} login The held own-browser login.
 * @param {string} provider The provider name, for a login with no request.
 * @returns {Object} `{login_endpoint, login_request}` for the login call.
 */
export function hostedWindowRetry(login, provider) {
  return {
    login_endpoint: login?.login_endpoint || '/connect_account/browser/start',
    login_request: {
      ...(login?.login_request ?? (provider ? { provider } : {})),
      use_hosted_browser: true,
    },
  };
}

/**
 * Whether a finish answer connected the account.
 *
 * The finish route answers `200` either way, carrying `ok: false` and the
 * daemon's own words when the browser held no session for the site yet — so
 * the message the owner reads is the one that names what to do about it.
 *
 * @param {Object} result The answer from the finish endpoint.
 * @returns {boolean}
 */
export function ownBrowserSignInSucceeded(result) {
  return Boolean(result?.ok);
}

/**
 * The message to show when a finish did not connect the account.
 *
 * @param {Object} result The answer from the finish endpoint.
 * @param {string} [displayName] The provider's name, for a bare failure.
 * @returns {string}
 */
export function ownBrowserSignInFailure(result, displayName) {
  return (
    result?.error || `${displayName ?? 'The account'} was not connected.`
  );
}
