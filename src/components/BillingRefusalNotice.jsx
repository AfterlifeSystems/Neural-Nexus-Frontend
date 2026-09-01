// src/components/BillingRefusalNotice.jsx
//
// The refusal, said in the conversation it happened in.
//
// A toast is the right shape for "that did not send" — it is read once and
// dismissed. It is the wrong shape for the end of a month's allotment, which
// does not go away when the toast does: every message after it is refused the
// same way, and someone who closed the toast is left with a transcript that
// shows their message simply never happening. So the refusal is also written
// into the transcript, where it stays as long as the conversation is on screen
// and reads in sequence — after the messages that spent the allotment, before
// whatever the reader does about it.
//
// The card is the same offer the toast makes, and leads to the same screen:
// the customer portal, where an account subscribes or adds a payment method
// and a visitor signs up.

import React from 'react';
import { CreditCard } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import { readerIsAnonymousVisitor, resolveBillingPath } from './utils';

/**
 * The `type` a transcript entry carries when it is this notice rather than
 * something somebody said. Named here so the writer (MediaContext) and the
 * reader (MessageList) cannot disagree about it.
 */
export const BILLING_REFUSAL_MESSAGE_TYPE = 'billing_refusal';

/**
 * Build the transcript entry for a refused metered request.
 *
 * @param {Error} requestError The HTTP 402 thrown by the API client.
 * @param {string} [fallbackMessage] Used when the error carries no sentence.
 * @returns {Object} A message for the messages array.
 */
export const buildBillingRefusalMessage = (
  requestError,
  fallbackMessage = 'This request was refused: the monthly allotment is spent.'
) => ({
  id: `billing-refusal-${Date.now()}`,
  type: BILLING_REFUSAL_MESSAGE_TYPE,
  content: requestError?.message || fallbackMessage,
  timestamp: new Date().toISOString(),
});

/**
 * Render one refusal in the transcript.
 *
 * @param {Object} parameters
 * @param {Object} parameters.message The transcript entry to render.
 */
const BillingRefusalNotice = ({ message }) => {
  const navigate = useNavigate();
  const location = useLocation();
  // Unlike the toast — whose host is mounted outside the router — this is
  // rendered inside it, so billing opens without reloading the application.
  const billingPath = resolveBillingPath(location.pathname);
  const reasonToOpenBilling = readerIsAnonymousVisitor(location.pathname)
    ? 'to sign up and keep chatting'
    : 'to subscribe or add a payment method';

  return (
    // Full width and centred rather than stuck to either edge: this is not
    // something the user said or something the avatar said, and a bubble on one
    // side or the other would read as one of them saying it.
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(billingPath)}
      onKeyDown={(keyEvent) => {
        if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
          keyEvent.preventDefault();
          navigate(billingPath);
        }
      }}
      className="group self-stretch w-full my-2 flex items-start gap-3 p-3 rounded-xl cursor-pointer bg-white/5 border border-teal-400/30 hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
    >
      <CreditCard className="w-5 h-5 shrink-0 mt-0.5 text-teal-300" />
      <div className="min-w-0">
        <p className="text-sm text-white/90 whitespace-pre-wrap">
          {message.content}
        </p>
        <p className="mt-1 text-sm text-white/60">
          Open{' '}
          <span className="font-semibold text-teal-300 underline underline-offset-2 group-hover:text-teal-200">
            Billing
          </span>{' '}
          {reasonToOpenBilling}.
        </p>
      </div>
    </div>
  );
};

export default BillingRefusalNotice;
