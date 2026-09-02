# Single sign-on into the embedded billing portal

**Status: working end to end in the TEST environment as of 2026-09-02; live
still awaits its shared secret and a portal deploy.** The Neural Nexus API mints
the credential, the web application hands it to the portal frame, and the
customer portal accepts it.

Test environment — all three sides configured and verified:

| Side | Where | State |
|---|---|---|
| Neural Nexus API | `anubis/.env.dev` → `BILLING_PORTAL_EXCHANGE_SECRET` | set |
| Portal server | `anubis-customer-portal/src/server/.env.dev` → `NN_EXCHANGE_SHARED_SECRET` | set to the same value |
| This app | `.env.dev` → `VITE_NEURAL_NEXUS_API_BASE_URL=http://localhost:9600`, `VITE_BILLING_PORTAL_URL=http://localhost:5171` | already pointed at both |

Verified 2026-09-02: a code minted with the shared secret and spent at the
portal's `POST /auth/single_sign_on` returns a verified portal session
(HTTP 200), and replaying the same code is refused (HTTP 400, "already
redeemed"). Before the secret was set, `POST /redeem_billing_portal_exchange_code`
on the API answered 503 and the portal's route did not exist in the running
container at all.

**Live is still off.** `BILLING_PORTAL_EXCHANGE_SECRET` is empty in
`anubis/.env`, `NN_EXCHANGE_SHARED_SECRET` is absent from the portal's `.env`,
and the running `portal-live` container predates the route. Until all three are
addressed the live embed shows the portal's own sign-in card — every failure
path falls back to it, which is the designed behaviour, not a break.

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

**The portal** (`anubis-customer-portal`)

| Piece | Where |
|---|---|
| Redemption call + signing headers | `src/server/neural_nexus_gateway.py` (`redeem_billing_portal_exchange_code`), `src/server/billing_portal_exchange_signature.py` |
| `POST /auth/single_sign_on` | `src/server/routers/auth.py` — mints the same session `/auth/login` does, from a code instead of a password |
| Shared secret | `NN_EXCHANGE_SHARED_SECRET` → `PortalSettings.nn_exchange_shared_secret` |
| Frame listener | `src/client/src/singleSignOn.ts`, started from `src/client/src/main.tsx` before first render; `App.tsx` redraws on it |
| Tests | `src/server/tests/test_portal_flow.py`, `src/server/tests/test_billing_portal_exchange_signature.py` |

The server route POSTs the code to the API's `/redeem_billing_portal_exchange_code`
with the two signature headers above, takes the `email` off the response, and
reuses `find_customer_by_email` → `mint_session_token` unchanged.
`mint_session_token` is called with `nn_refresh_token=None`, because that token
deliberately never reaches the portal — so a session created this way has nothing
for `/auth/logout` to revoke, and portal sign-out ends the portal session only.

The client registers its `message` listener before first render, checks
`event.origin` against `VITE_NEURAL_NEXUS_APP_ORIGINS` (the same allowlist
`appReturn.ts` validates `return_to` against), exchanges the code, calls
`setSessionToken`, and posts the acknowledgement back to `event.source` at that
same origin so the parent stops retrying. `api.ts` decides `tabIsAnonymous` once
at load and `setSessionToken` clears that flag, so a late exchange is safe;
registering early only avoids a flash of the anonymous view.

## What remains — deployment

Test is done (see the status block above). For **live**:

1. Set `BILLING_PORTAL_EXCHANGE_SECRET` in `anubis/.env` and
   `NN_EXCHANGE_SHARED_SECRET` in the portal's `src/server/.env` to the same
   value — a *different* value from the test pair, so a test code cannot be
   spent against live. Restart the Neural Nexus API (`langgraph-api-prod`) after
   the first; the secret is read into `GlobalContext` at lifespan startup.
2. Rebuild the portal live server — `cd src/server && docker compose -f
   docker-compose.yml up --build -d`. The running `portal-live` image predates
   this feature and has no `/auth/single_sign_on` route (it also predates the
   usage-stream routes, which the deployed client is already polling for).
   Note the server compose mounts no source, so a rebuild is required; the
   client compose does mount `./src`, so the client picks changes up on its own.
3. Deploy the portal client (Vercel → `checkout.neuralnexus.site`). The embed
   loads the deployed portal, so local portal changes do nothing for it.

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
