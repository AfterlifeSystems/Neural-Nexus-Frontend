// BillingManagement.jsx
//
// Billing lives in the hosted customer portal (checkout.neuralnexus.site),
// which owns subscriptions, payment methods, invoices, and usage meters.
// This component only links out; no billing state is held in this
// application.

import React from 'react';
import { ExternalLink } from 'lucide-react';

const BILLING_PORTAL_URL =
  import.meta.env.VITE_BILLING_PORTAL_URL ?? 'https://checkout.neuralnexus.site';

const BillingManagement = () => {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-white">Billing</h1>
      <p className="text-white/70">
        Subscriptions, payment methods, invoices, and usage are managed in the
        Neural Nexus customer portal.
      </p>
      <a
        href={BILLING_PORTAL_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded-lg text-white font-semibold transition"
      >
        <ExternalLink size={18} />
        Open the customer portal
      </a>
    </div>
  );
};

export default BillingManagement;
