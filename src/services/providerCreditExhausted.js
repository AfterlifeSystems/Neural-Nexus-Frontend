// The operator's model account (OpenAI and the like) has no credit left.
//
// This is not the reader's monthly allotment. A 402 / `allotment_exhausted`
// sends them to billing. This failure is the service's: every reply will fail
// the same way until the operator funds the vendor again. The code the stream
// `error` frame carries is `model_provider_credit_exhausted`; raw vendor
// sentences are recognised as a fallback when a path has not classified them.

export const PROVIDER_CREDIT_EXHAUSTED_CODE = 'model_provider_credit_exhausted';

export const PROVIDER_CREDIT_NOTICE_TITLE =
  'We are experiencing technical difficulties.';

export const PROVIDER_CREDIT_NOTICE_BODY =
  'Thank you for your patience. Replies are unavailable from the Neural Nexus at the moment. Please try again later.';

// Same markers the API uses to classify a mid-stream vendor refusal
// (`_VENDOR_CREDIT_EXHAUSTED_MARKERS` in f-anubis `webapp.py`). Keep them in
// step so a sentence that missed the structured code still reaches this notice.
const VENDOR_CREDIT_EXHAUSTED_MARKERS = [
  'insufficient_quota',
  'exceeded your current quota',
  'credit balance is too low',
  'billing_hard_limit_reached',
  'insufficient credits',
  'insufficient_credits',
  'out of credits',
  PROVIDER_CREDIT_EXHAUSTED_CODE,
];

/**
 * Flatten the places a classified or raw vendor refusal can sit on an error.
 *
 * @param {Error|null|undefined} requestError
 * @returns {string}
 */
function requestErrorText(requestError) {
  if (!requestError) return '';
  const body = requestError.body;
  const detail = body?.detail;
  return [
    requestError.code,
    requestError.message,
    body?.code,
    body?.error,
    typeof detail === 'string' ? detail : null,
    detail && typeof detail === 'object' ? detail.code : null,
    detail && typeof detail === 'object' ? detail.error : null,
  ]
    .filter((part) => typeof part === 'string' && part.trim())
    .join(' ')
    .toLowerCase();
}

/**
 * Whether this failure is the model vendor refusing for want of the
 * operator's credit, not the reader's allotment.
 *
 * @param {Error|null|undefined} requestError
 * @returns {boolean}
 */
export function isProviderCreditExhausted(requestError) {
  if (!requestError) return false;
  if (requestError.code === PROVIDER_CREDIT_EXHAUSTED_CODE) return true;
  const body = requestError.body;
  if (body && typeof body === 'object') {
    if (body.code === PROVIDER_CREDIT_EXHAUSTED_CODE) return true;
    if (body.error === PROVIDER_CREDIT_EXHAUSTED_CODE) return true;
    const detail = body.detail;
    if (detail && typeof detail === 'object') {
      if (detail.code === PROVIDER_CREDIT_EXHAUSTED_CODE) return true;
      if (detail.error === PROVIDER_CREDIT_EXHAUSTED_CODE) return true;
    }
  }
  const text = requestErrorText(requestError);
  return VENDOR_CREDIT_EXHAUSTED_MARKERS.some((marker) => text.includes(marker));
}
