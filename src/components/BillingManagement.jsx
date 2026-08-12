// BillingManagement.jsx
//
// Billing lives in the hosted customer portal (checkout.neuralnexus.site),
// which owns subscriptions, payment methods, invoices, and usage meters. This
// page embeds that portal rather than reimplementing any of it: no billing
// state is held in this application, and nothing here talks to Stripe.

import React, { useState } from 'react';
import { ExternalLink, CreditCard } from 'lucide-react';

const BILLING_PORTAL_URL =
  import.meta.env.VITE_BILLING_PORTAL_URL ?? 'https://checkout.neuralnexus.site';

const BillingManagement = () => {
  const [hasLoaded, setHasLoaded] = useState(false);

  return (
    <div className="h-full flex flex-col p-4 sm:p-6 gap-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <CreditCard className="w-6 h-6" />
          Billing
        </h1>
        {/* A way out of the frame. Some payment steps insist on a full window,
            and a portal that will not render inside an iframe leaves no other
            route — so the escape hatch is always present rather than appearing
            only once something has gone wrong. */}
        <a
          href={BILLING_PORTAL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-white transition"
        >
          Open in a new tab
          <ExternalLink size={16} />
        </a>
      </div>

      <div className="relative flex-grow min-h-[600px] rounded-2xl overflow-hidden border border-white/20 bg-black/30">
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
          src={BILLING_PORTAL_URL}
          title="Neural Nexus customer portal"
          className="w-full h-full"
          allow="payment; clipboard-write"
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => setHasLoaded(true)}
        />
      </div>

      <p className="text-white/40 text-xs">
        Subscriptions, payment methods, invoices, and usage are managed in the
        Neural Nexus customer portal above.
      </p>
    </div>
  );
};

export default BillingManagement;
