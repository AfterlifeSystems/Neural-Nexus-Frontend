// src/components/requestFailureToast.jsx
//
// One place that decides what a failed API request looks like to the person who
// caused it.
//
// Most failures are a sentence: the API says what went wrong and the sentence
// is what gets shown. One class of failure is different. When a metered request
// is refused because the month's allotment is spent, the API answers HTTP 402
// with a sentence naming the two ways out — subscribe to a paid tier, or add a
// payment method and enable pay-per-use. Both of those happen in the customer
// portal, which this application embeds on its billing screen. Reporting that
// sentence on its own tells the reader what to do and gives them nothing to do
// it with, so this refusal is shown with a control that opens billing.
//
// The offer is the same whether or not the reader has an account: the portal on
// that screen is where an anonymous visitor signs up and where an account adds
// a payment method.
//
// That refusal also does not time out. Every other toast here reports something
// the reader only has to read, so a timer is right for it; this one asks for a
// decision, and a refusal that erases itself mid-thought leaves someone stuck
// with no idea why their message would not send. It stays until the reader
// presses Close.

import React from 'react';
import { toast } from 'react-hot-toast';
import { CreditCard } from 'lucide-react';

import { readerIsAnonymousVisitor, resolveBillingPath } from './utils';

/** The status the API refuses a spent allotment with. */
const PAYMENT_REQUIRED_STATUS = 402;

/**
 * Whether this failure is the API refusing a request for want of allotment.
 *
 * @param {Error} requestError An error thrown by the API client.
 * @returns {boolean} Whether the refusal is about billing.
 */
export const isBillingRefusal = (requestError) =>
  requestError?.status === PAYMENT_REQUIRED_STATUS;

/**
 * Report a failed API request to the user.
 *
 * @param {Error} requestError The error thrown by the API client.
 * @param {Object} [options]
 * @param {string} [options.fallbackMessage] What to say when the error carries
 *   no message of its own.
 * @param {...*} [options.toastOptions] Anything else is passed through to
 *   react-hot-toast (`position`, `duration`, ...).
 */
export function showRequestFailureToast(requestError, options = {}) {
  const { fallbackMessage = 'The request failed.', ...toastOptions } = options;
  const description = requestError?.message || fallbackMessage;

  if (!isBillingRefusal(requestError)) {
    toast.error(description, toastOptions);
    return;
  }

  const billingPath = resolveBillingPath();
  // Someone with no session is being invited to sign up; someone with one is
  // being sent to the subscription and payment method they already have. Both
  // land on the same screen, so only the reason for going differs.
  const reasonToOpenBilling = readerIsAnonymousVisitor()
    ? 'to sign up and keep chatting'
    : 'to subscribe or add a payment method';

  // A full navigation rather than a router push: the toast host is mounted
  // outside the router (see main.jsx), so no router hook and no <Link> is
  // available from in here.
  const openBilling = (billingToastId) => {
    toast.dismiss(billingToastId);
    window.location.assign(billingPath);
  };

  // toast.custom rather than toast.error: this is a two-pane card — the
  // refusal, which opens billing when pressed, and a Close button divided off
  // from it — and toast.error renders its message inside its own bar. The
  // colours are the ones the Toaster gives every other toast (see main.jsx),
  // set here because a custom toast is not passed them.
  toast.custom(
    (billingToast) => (
      <div
        className={`${
          billingToast.visible
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 -translate-y-2'
        } transition-all duration-200 max-w-md w-full flex pointer-events-auto rounded-lg shadow-lg backdrop-blur-lg bg-[rgba(30,30,40,0.95)] ring-1 ring-white/15`}
      >
        {/* The text is the control. Pressing anywhere in it opens billing, and
            the word Billing is underlined inside the sentence so that is
            legible before the press rather than discovered by it. A div with a
            button role rather than a button, because the Close button beside
            it would otherwise be a button inside a button. */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => openBilling(billingToast.id)}
          onKeyDown={(keyEvent) => {
            if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
              keyEvent.preventDefault();
              openBilling(billingToast.id);
            }
          }}
          className="group flex-1 w-0 p-4 text-left cursor-pointer rounded-l-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
        >
          <div className="flex items-start gap-3">
            <CreditCard className="w-5 h-5 shrink-0 mt-0.5 text-teal-300" />
            <div className="min-w-0">
              <p className="text-sm text-white">{description}</p>
              <p className="mt-1 text-sm text-white/60">
                Open{' '}
                <span className="font-semibold text-teal-300 underline underline-offset-2 group-hover:text-teal-200">
                  Billing
                </span>{' '}
                {reasonToOpenBilling}.
              </p>
            </div>
          </div>
        </div>

        {/* Closing is its own pane, divided from the text, so dismissing the
            refusal and acting on it cannot be the same press. */}
        <div className="flex border-l border-white/15">
          <button
            onClick={() => toast.dismiss(billingToast.id)}
            className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-white/70 hover:text-white focus:outline-none focus:ring-2 focus:ring-teal-400 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    ),
    {
      ...toastOptions,
      // Last, and deliberately not overridable: this toast is dismissed by the
      // reader, never by a timer.
      duration: Infinity,
    }
  );
}
