// src/services/billingPortalSingleSignOn.js
//
// Signing the current user in to the customer portal embedded on the billing
// page, so somebody who has already signed in here is not asked to sign in a
// second time inside the frame.
//
// The portal is a separate application on a separate origin with its own
// session, so nothing this application does to the frame can sign anybody in
// directly. What it can do is hand the portal a credential the portal's own
// server will accept. That credential is a **billing portal exchange code**:
// minted by POST /create_billing_portal_exchange_code, valid for two minutes,
// spendable once, and carrying nothing but "this account is authenticated right
// now". The account's session credential — the refresh token this application
// holds — never crosses into the portal's origin.
//
// The handshake is deliberately noisy on this side and silent on failure:
//
// * The code is posted repeatedly rather than once, because the frame's
//   listener may not exist yet when the frame's load event fires here. The
//   portal answers with an acknowledgement, which is what stops the retries.
// * Every message names the portal's exact origin, never '*', so a frame that
//   turned out to be some other page cannot receive the code.
// * Every acknowledgement is checked against that same origin, so no other
//   frame or window can end the handshake early.
// * Any failure at all — no session, single sign-on not configured on the API,
//   an unreachable API, a portal that never answers — leaves the portal showing
//   its ordinary sign-in card. Nothing is surfaced to the user, because there is
//   nothing for the user to do about it, and the page still works.

import { requestJson, getSessionCredential } from './neuralNexusApiClient';

/** Message this application posts into the portal frame, carrying the code. */
export const SINGLE_SIGN_ON_MESSAGE_TYPE = 'neural-nexus-portal-single-sign-on';

/** Message the portal posts back once it has accepted the code. */
export const SINGLE_SIGN_ON_ACKNOWLEDGEMENT_MESSAGE_TYPE =
  'neural-nexus-portal-single-sign-on-acknowledged';

// Fifteen attempts at four hundred milliseconds covers six seconds of the
// code's two-minute life, which is far longer than a frame takes to register a
// listener after its load event. Bounded rather than open-ended so a portal that
// does not implement its half of the handshake — every deployment before this
// feature ships there — costs a few messages into the void rather than a timer
// that runs for as long as the page is open.
const HANDSHAKE_ATTEMPT_LIMIT = 15;
const HANDSHAKE_ATTEMPT_INTERVAL_MILLISECONDS = 400;

/**
 * Mint a single-use code that signs the current account in to the customer
 * portal. POST /create_billing_portal_exchange_code
 *
 * @returns {Promise<Object>} `{exchange_code, expires_in_seconds}`.
 */
export async function createBillingPortalExchangeCode() {
  return requestJson('/create_billing_portal_exchange_code', { method: 'POST' });
}

/**
 * Hand the customer portal frame a code for the current account, retrying until
 * the frame acknowledges it.
 *
 * Safe to call when nobody is signed in and safe to call against a portal that
 * does not implement the handshake: both simply do nothing.
 *
 * @param {Object} options
 * @param {HTMLIFrameElement} options.portalFrame The rendered portal frame.
 * @param {string} options.portalUrl The URL the frame was pointed at; its origin
 *   is what every message is pinned to.
 * @returns {Function} Cancels the handshake and removes its listener. Call it
 *   when the frame goes away — the handshake outlives a single render otherwise.
 */
export function signInToBillingPortalFrame({ portalFrame, portalUrl }) {
  // Nobody is signed in here, so there is no session to hand over and the portal
  // should show its own sign-in card.
  if (!getSessionCredential()) {
    return () => {};
  }

  let portalOrigin;
  try {
    portalOrigin = new URL(portalUrl, window.location.href).origin;
  } catch {
    // A malformed VITE_BILLING_PORTAL_URL is a configuration error that already
    // shows itself as a frame that will not load; it must not also throw here.
    return () => {};
  }

  let hasBeenCancelled = false;
  let attemptTimer = null;

  const acknowledgementListener = (event) => {
    if (event.origin !== portalOrigin) {
      return;
    }
    if (event.data?.type === SINGLE_SIGN_ON_ACKNOWLEDGEMENT_MESSAGE_TYPE) {
      stopHandshake();
    }
  };

  function stopHandshake() {
    hasBeenCancelled = true;
    if (attemptTimer !== null) {
      clearInterval(attemptTimer);
      attemptTimer = null;
    }
    window.removeEventListener('message', acknowledgementListener);
  }

  window.addEventListener('message', acknowledgementListener);

  createBillingPortalExchangeCode()
    .then((response) => {
      const exchangeCode = response?.exchange_code;
      if (hasBeenCancelled || !exchangeCode) {
        stopHandshake();
        return;
      }

      let attemptsMade = 0;
      const postExchangeCode = () => {
        attemptsMade += 1;
        // Read the frame's window on every attempt rather than capturing it: a
        // frame that navigates replaces its content window, and a captured one
        // would then be posting into a document nobody is looking at.
        portalFrame?.contentWindow?.postMessage(
          { type: SINGLE_SIGN_ON_MESSAGE_TYPE, exchangeCode },
          portalOrigin
        );
        if (attemptsMade >= HANDSHAKE_ATTEMPT_LIMIT) {
          stopHandshake();
        }
      };

      postExchangeCode();
      if (!hasBeenCancelled) {
        attemptTimer = setInterval(
          postExchangeCode,
          HANDSHAKE_ATTEMPT_INTERVAL_MILLISECONDS
        );
      }
    })
    .catch(() => {
      // 503 when the API has no BILLING_PORTAL_EXCHANGE_SECRET configured, 401
      // when the stored session has expired, anything else when the API is
      // unreachable. In every case the portal's own sign-in is the fallback, so
      // there is nothing to report and nothing to retry.
      stopHandshake();
    });

  return stopHandshake;
}
