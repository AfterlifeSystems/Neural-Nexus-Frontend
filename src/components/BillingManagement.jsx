// BillingManagement.jsx
//
// Billing lives in the hosted customer portal (checkout.neuralnexus.site),
// which owns subscriptions, payment methods, invoices, and usage meters. This
// page embeds that portal rather than reimplementing any of it: no billing
// state is held in this application, and nothing here talks to Stripe.

import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ExternalLink, CreditCard } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import { SHARED_AVATAR_ROUTE_PREFIX } from './utils';

const BILLING_PORTAL_URL =
  import.meta.env.VITE_BILLING_PORTAL_URL ??
  'https://checkout.neuralnexus.site';

/**
 * The portal URL to embed, naming this page as where the customer came from.
 *
 * Changing a plan cannot happen inside the frame: Stripe refuses to be framed,
 * so the portal takes the whole tab to Stripe and Stripe returns it to the
 * portal — which is a different application on a different domain, with this
 * one nowhere in sight. `return_to` is how the portal knows to bring the
 * customer back here afterwards; the portal validates the origin against its
 * own allowlist before it goes anywhere near a Stripe redirect URL.
 *
 * @returns {string} The portal URL with this page named as the return target.
 */
const buildBillingPortalUrl = () => {
  const portalUrl = new URL(BILLING_PORTAL_URL);
  portalUrl.searchParams.set('return_to', window.location.href);
  return portalUrl.toString();
};

import UserSettingsMenu from './UserSettingsMenu';
import { signInToBillingPortalFrame } from '../services/billingPortalSingleSignOn';

/**
 * @param {Object} props
 * @param {boolean} [props.showAccountMenu] Whether to render the account menu
 *   beneath the portal. It is omitted on the shared-link route, where the viewer
 *   has no account for it to act on: every entry in it requires a session.
 */
const BillingManagement = ({ showAccountMenu = true }) => {
  const navigate = useNavigate();
  const { avatarId } = useParams();
  const [hasLoaded, setHasLoaded] = useState(false);
  // Resolved once per mount: the frame must not be handed a new src on every
  // render, which would reload the portal underneath whoever is using it.
  const [billingPortalUrl] = useState(buildBillingPortalUrl);
  const portalFrameRef = useRef(null);
  // Holds the running handshake's canceller so a reload of the frame replaces
  // the previous handshake instead of racing it, and so leaving the page stops
  // one that is still retrying.
  const cancelSingleSignOnRef = useRef(null);

  // A signed-in user should not sign in again inside the frame, so the frame is
  // handed a single-use code for this account as soon as it exists. It is done
  // on the load event and not on mount because before that the frame has no
  // content window to post a message into. Everything about this is
  // best-effort: with no session, no code, or a portal deployment that does not
  // implement its half of the handshake, the frame simply shows the portal's
  // own sign-in card, which is what it showed before this existed.
  const handlePortalFrameLoad = () => {
    setHasLoaded(true);
    cancelSingleSignOnRef.current?.();
    cancelSingleSignOnRef.current = signInToBillingPortalFrame({
      portalFrame: portalFrameRef.current,
      portalUrl: BILLING_PORTAL_URL,
    });
  };

  useEffect(() => () => cancelSingleSignOnRef.current?.(), []);

  /**
   * Leave billing for the application proper.
   *
   * A visitor on a shared link has one place to be — the avatar whose link they
   * followed — and no account to hold a gallery of avatars. Everyone else goes
   * to the gallery, which is where the application starts.
   */
  const leaveBilling = () => {
    navigate(
      avatarId ? `${SHARED_AVATAR_ROUTE_PREFIX}/${avatarId}` : '/avatars'
    );
  };

  return (
    <div className="h-full flex flex-col p-4 sm:p-6 gap-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-neutral-200 flex items-center gap-2">
            <CreditCard className="w-6 h-6" />
            Billing
          </h1>
        </div>
        {/* A way out of the frame. Some payment steps insist on a full window,
            and a portal that will not render inside an iframe leaves no other
            route — so the escape hatch is always present rather than appearing
            only once something has gone wrong. */}
        <a
          href={billingPortalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-black/50 hover:bg-white/10 border border-white/10 rounded-lg text-neutral-200 transition"
        >
          Open in a new tab
          <ExternalLink size={16} />
        </a>
      </div>

      <div className="relative flex-grow min-h-[600px] rounded-2xl overflow-hidden border border-white/10 bg-black/30">
        {!hasLoaded && (
          <div className="absolute inset-0 flex items-center justify-center text-white/60">
            Loading the customer portal…
          </div>
        )}
        {/* No `sandbox`: the portal is a separate origin, so it cannot reach
            into this page regardless, and sandboxing it would strip the
            cookies and storage its own sign-in depends on. `allow="payment"`
            lets the Payment Request API work inside the frame. */}
        <iframe
          ref={portalFrameRef}
          src={billingPortalUrl}
          title="Neural Nexus customer portal"
          className="w-full h-full"
          allow="payment; clipboard-write"
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={handlePortalFrameLoad}
        />
      </div>

      <p className="text-white/40 text-xs">
        Subscriptions, payment methods, invoices, and usage are managed in the
        Neural Nexus customer portal above.
      </p>

      {/* The control this page is usually reached from. Without it the menu
          vanished on arrival, leaving no way back except the sidebar. */}
      {showAccountMenu && <UserSettingsMenu className="shrink-0" />}
    </div>
  );
};

export default BillingManagement;
