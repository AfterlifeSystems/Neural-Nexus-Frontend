// src/components/ProviderCreditNotice.jsx
//
// The operator's model account has no credit left. Said in the conversation
// it happened in.
//
// A toast is the right shape for "that did not send" — it is read once and
// dismissed. It is the wrong shape for this pause: every message after it is
// refused the same way until the service is funded again, and someone who
// closed the toast is left with a transcript that shows their message simply
// never happening. So the pause is written into the transcript, where it
// stays as long as the conversation is on screen.
//
// This is not the reader's allotment. There is no Billing control. The card
// sits across the column the way the billing refusal does, so it is not
// mistaken for something the avatar or the reader said.

import React from 'react';

import {
  PROVIDER_CREDIT_NOTICE_BODY,
  PROVIDER_CREDIT_NOTICE_TITLE,
} from '../services/providerCreditExhausted';

/**
 * The `type` a transcript entry carries when it is this notice rather than
 * something somebody said. Named here so the writer (MediaContext) and the
 * reader (MessageList) cannot disagree about it.
 */
export const PROVIDER_CREDIT_NOTICE_MESSAGE_TYPE = 'provider_credit_notice';

/**
 * Build the transcript entry for a vendor-credit pause.
 *
 * @returns {Object} A message for the messages array.
 */
export const buildProviderCreditNoticeMessage = () => ({
  id: `provider-credit-${Date.now()}`,
  type: PROVIDER_CREDIT_NOTICE_MESSAGE_TYPE,
  title: PROVIDER_CREDIT_NOTICE_TITLE,
  content: PROVIDER_CREDIT_NOTICE_BODY,
  timestamp: new Date().toISOString(),
});

/**
 * Render one pause in the transcript.
 *
 * @param {Object} parameters
 * @param {Object} parameters.message The transcript entry to render.
 */
const ProviderCreditNotice = ({ message }) => {
  const title = message.title || PROVIDER_CREDIT_NOTICE_TITLE;
  const body = message.content || PROVIDER_CREDIT_NOTICE_BODY;

  return (
    // Full width and centred rather than stuck to either edge: this is not
    // something the user said or something the avatar said, and a bubble on one
    // side or the other would read as one of them saying it.
    <div
      role="status"
      className="self-stretch w-full my-2 p-3 rounded-xl bg-black/60 border border-neutral-400/30"
    >
      <p className="text-sm font-medium text-white/90">{title}</p>
      <p className="mt-1 text-sm text-white/60 whitespace-pre-wrap">{body}</p>
    </div>
  );
};

export default ProviderCreditNotice;
