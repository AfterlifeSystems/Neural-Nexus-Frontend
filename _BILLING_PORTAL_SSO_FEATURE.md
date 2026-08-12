# Single sign-on into the embedded billing portal

**Status: tabled.** Nothing is implemented. `/billing` embeds the portal and the
portal shows its own sign-in card. This note records what the feature is, why it
cannot be done from this repository alone, and everything already established so
the work can start without re-deriving it.

## What it is

A user who is signed in to Neural Nexus opens `/billing` and is already signed
in to the billing portal embedded there — no second login. Formally: **SSO by
session handoff, implemented as a token exchange** (the standardised form is
OAuth 2.0 Token Exchange, RFC 8693). The iframe-specific half is **cross-origin
session propagation** via `postMessage`.

## Why it is not just a frontend change

The portal is a separate application with its own session, minted by its own
server. It does not share a credential with this app, so there is nothing this
repository can put in front of it that would sign anybody in.

What exists today, verified by reading the source:

| Piece | Where | Behaviour |
|---|---|---|
| Portal sign-in | `anubis-customer-portal/src/client/src/components/LoginCard.tsx` | posts email + password to `POST /auth/login`, then `setSessionToken(session.token)` |
| Portal session | `anubis-customer-portal/src/client/src/api.ts` | token in `localStorage` under `neural_nexus_portal_session_token`, sent as `Authorization: Bearer <token>` |
| Portal login route | `anubis-customer-portal/src/server/routers/auth.py` | verifies the password through the Neural Nexus API, finds the Stripe customer **by email**, then `mint_session_token(settings, customer["id"], email, nn_refresh_token=…)` and returns `{token, email, customer_id}` |
| This app's credential | `Neural-Nexus-Frontend/src/services/neuralNexusApiClient.js` | the Neural Nexus refresh token, `localStorage` key `neural_nexus_session_credential`, sent as `Authorization: Bearer` |
| The embed | `Neural-Nexus-Frontend/src/components/BillingManagement.jsx` | iframe at `VITE_BILLING_PORTAL_URL` (default `https://checkout.neuralnexus.site`) |

The portal session is a portal-minted JWT carrying the Neural Nexus refresh
token — **not** the refresh token itself. So the exchange has to happen on the
portal's server, which is the piece that does not exist.

## The three pieces required

1. **Portal server** — a route that mints the *same* session JWT from a Neural
   Nexus credential instead of a password. It already does every other step of
   this: only the first line of `POST /auth/login` changes. Verify the supplied
   credential by calling the Neural Nexus API with
   `Authorization: Bearer <credential>` (that API accepts the refresh token as a
   bearer as of the auth work in `anubis`), read the email off the authenticated
   user, then reuse `find_customer_by_email` → `mint_session_token` unchanged.
2. **Portal client** — on load, if running inside a frame, accept the credential
   the parent posts and exchange it through that route, then `setSessionToken`.
   Note `api.ts` decides `tabIsAnonymous` once at load; `setSessionToken` already
   clears that flag, so an exchange after load is safe, but a listener added
   before first render avoids a flash of the anonymous view.
3. **This app** — post the credential to the frame on load, pinned to the
   portal's exact origin, and retry until the frame acknowledges (the listener
   may not be ready when the first message is sent).

## Credential to hand over — the open decision

- **Pass the refresh token.** Smallest change; no Neural Nexus API work. The
  portal already receives the password today, so this is not a wider trust
  boundary — but a full account credential crosses into that origin.
- **Mint a one-time exchange code.** The Neural Nexus API issues a short-lived,
  single-use code the portal redeems; the refresh token never leaves this app.
  Safer, and costs a third change: a new endpoint on the Neural Nexus API.

## Constraints and hazards

- **A portal deploy is required.** The embed loads the deployed portal
  (`checkout.neuralnexus.site` → `anubis-customer-portal.vercel.app`). Local
  portal changes do nothing for the embed until deployed. To develop the flow
  end to end first, point `VITE_BILLING_PORTAL_URL` at the local portal.
- **Pin both origins.** The sender must name the portal's exact origin, never
  `"*"`; the portal must check `event.origin` against this app's origin.
  Otherwise any page that frames the portal, or any frame this app loads, can
  fish for the credential.
- **Third-party cookies are not an option.** A shared `.neuralnexus.site` cookie
  would be a third-party cookie inside the iframe and is blocked by default in
  current browsers. The handshake has to be explicit.
- **Failure must be silent and safe.** If the exchange fails for any reason, the
  portal shows its ordinary sign-in card — never a broken frame. The
  "Open in a new tab" escape hatch on `/billing` stays regardless.

## How it would be verified

1. Portal server: a unit test that a valid Neural Nexus credential yields the
   same session shape as `POST /auth/login`, and that an invalid or revoked one
   is refused.
2. Signed in to this app, open `/billing`: the frame shows the account's
   subscription without a login card, and the portal reports the right email.
3. Signed out, open `/billing`: the frame shows its sign-in card, unchanged.
4. A page on another origin framing the portal receives nothing.
5. Log out of this app, return to `/billing`: no stale portal session.
