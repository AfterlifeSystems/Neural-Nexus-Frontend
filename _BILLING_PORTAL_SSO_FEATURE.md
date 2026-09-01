# Single sign-on into the embedded billing portal

**Status: two of three sides built.** The Neural Nexus API mints the credential
and the web application hands it to the portal frame. The customer portal does
not yet accept it, so today the handshake is a few messages into a frame that
ignores them and the portal still shows its own sign-in card. Nothing regresses
while that half is missing.

## What it is

A user who is signed in to Neural Nexus opens `/billing` and is already signed
in to the billing portal embedded there — no second login. Formally: **SSO by
session handoff, implemented as a token exchange** (the standardised form is
OAuth 2.0 Token Exchange, RFC 8693). The iframe-specific half is **cross-origin
session propagation** via `postMessage`.

The portal is a separate application with its own session, minted by its own
server, sharing no credential with this app. So the handoff is a credential this
API mints *for the portal*: a **billing portal exchange code** — short-lived,
single-use, and carrying only "this account is authenticated right now". The
Neural Nexus refresh token this app authenticates with never crosses into the
portal's origin. That was the open decision in the earlier draft of this note;
it is now settled in favour of the exchange code.

## What is built

**Neural Nexus API** (`anubis`, branch `test`)

| Piece | Where |
|---|---|
| Mint / redeem / signature logic | `src/security/billing_portal_single_sign_on.py` |
| `POST /create_billing_portal_exchange_code` | `src/security/auth.py` — authenticated as the user (`get_current_user`), returns `{exchange_code, expires_in_seconds}` |
| `POST /redeem_billing_portal_exchange_code` | `src/security/auth.py` — machine-to-machine, returns `{user_id, email}` |
| Shared secret | `BILLING_PORTAL_EXCHANGE_SECRET` → `GlobalContext.billing_portal_exchange_secret` |
| Tests | `tests/unit_tests/test_billing_portal_single_sign_on.py` |

The code is a JWT (HS256, signed with the shared secret) carrying
`iss=neural-nexus-api`, `aud=neural-nexus-customer-portal`, `sub`, `email`,
`iat`, `exp` (120 seconds), `jti`. Issuer, audience, expiry, and signature are
all verified on redemption, and the `jti` is remembered for the code's lifetime
so a code is spendable once. That memory is per worker, so expiry — not the
`jti` — is what actually bounds a replay.

Redemption is authenticated by an HMAC-SHA256 over `'<timestamp>.<body>'` keyed
by the same shared secret, in `X-Neural-Nexus-Portal-Timestamp` and
`X-Neural-Nexus-Portal-Signature`; the timestamp must be within 300 seconds.
This is the same construction the usage-event push already uses in the other
direction. Without it, anyone who observed a code could turn it into a
customer's email address.

**This app** (`Neural-Nexus-Frontend`)

| Piece | Where |
|---|---|
| Code request + frame handshake | `src/services/billingPortalSingleSignOn.js` |
| Frame wiring | `src/components/BillingManagement.jsx` — starts the handshake on the iframe's `load`, cancels it on unmount |

On the frame's load event the app requests a code and posts
`{type: 'neural-nexus-portal-single-sign-on', exchangeCode}` into the frame,
pinned to the portal's exact origin, retrying every 400 ms up to 15 times. It
stops on a `{type: 'neural-nexus-portal-single-sign-on-acknowledged'}` message
from that same origin. Retries exist because the frame's listener may not be
registered when the first message is sent; the cap exists so a portal that never
answers costs a handful of messages rather than a timer for the life of the page.

## What remains — the portal

`anubis-customer-portal`. Two changes:

1. **Server** — a route that mints the *same* session as `POST /auth/login` from
   an exchange code instead of a password. Only the first step differs: POST the
   code to the API's `/redeem_billing_portal_exchange_code` with the two
   signature headers above, take the `email` off the response, then reuse
   `find_customer_by_email` → `mint_session_token` unchanged. Add
   `nn_exchange_shared_secret` to `settings.py` (env `NN_EXCHANGE_SHARED_SECRET`,
   which must equal the API's `BILLING_PORTAL_EXCHANGE_SECRET` exactly).
   `mint_session_token` is called with `nn_refresh_token=None`, because that
   token deliberately never reaches the portal — so a session created this way
   has nothing for `/auth/logout` to revoke, and portal sign-out ends the portal
   session only.
2. **Client** — when running inside a frame, register a `message` listener
   *before first render*, check `event.origin` against this app's origin, exchange
   the code through that route, `setSessionToken`, and post
   `{type: 'neural-nexus-portal-single-sign-on-acknowledged'}` back to
   `event.source` so the parent stops retrying. `api.ts` decides `tabIsAnonymous`
   once at load and `setSessionToken` already clears that flag, so a late exchange
   is safe — registering the listener early only avoids a flash of the anonymous
   view.

## Constraints and hazards

- **A portal deploy is required.** The embed loads the deployed portal
  (`checkout.neuralnexus.site` → `anubis-customer-portal.vercel.app`). Local
  portal changes do nothing for the embed until deployed. To develop the flow
  end to end first, point `VITE_BILLING_PORTAL_URL` at the local portal.
- **The secret must match on both sides.** Set
  `BILLING_PORTAL_EXCHANGE_SECRET` (API) and `NN_EXCHANGE_SHARED_SECRET`
  (portal) to the same value. Empty on the API side is a supported state: both
  endpoints answer 503, the handshake gives up, and the portal shows its
  sign-in card.
- **Pin both origins.** The sender names the portal's exact origin, never `"*"`
  (done); the portal must check `event.origin` against this app's origin.
  Otherwise any page that frames the portal, or any frame this app loads, can
  fish for the code.
- **Third-party cookies are not an option.** A shared `.neuralnexus.site` cookie
  would be a third-party cookie inside the iframe and is blocked by default in
  current browsers. The handshake has to be explicit.
- **Failure must be silent and safe** (done on this side): every failure path —
  no session, single sign-on unconfigured, an unreachable API, a portal that
  never answers — leaves the portal's ordinary sign-in card. The "Open in a new
  tab" escape hatch on `/billing` stays regardless.

## How it would be verified

1. Portal server: a unit test that a valid exchange code yields the same session
   shape as `POST /auth/login`, and that an expired, forged, or already-spent one
   is refused. (The API half of this is covered by
   `tests/unit_tests/test_billing_portal_single_sign_on.py`.)
2. Signed in to this app, open `/billing`: the frame shows the account's
   subscription without a login card, and the portal reports the right email.
3. Signed out, open `/billing`: the frame shows its sign-in card, unchanged.
4. A page on another origin framing the portal receives nothing.
5. Log out of this app, return to `/billing`: no stale portal session.
