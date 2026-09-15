// The operator's vendor account cannot serve: no credit. Every reply and
// every spoken line fails the same way until that account is funded.
//
// This is not the reader's monthly allotment. A 402 / `allotment_exhausted`
// sends them to billing. The code the stream `error` frame carries is
// `model_provider_credit_exhausted`; raw vendor quota sentences are recognised
// as a fallback when a path has not classified them.
//
// A refused vendor *key* (401 invalid_api_key) is a different failure. That
// is a credential the operator must replace, not empty funds. Matching it
// here used to show "the API has run out of funds" on Speak and speech-to-text
// while the reader's Neural Nexus allotment was still fine. See
// `isProviderKeyRefused`. A Neural Nexus session 401 ("Invalid API key" with
// spaces, no vendor name) is neither of these refusals.

export const PROVIDER_CREDIT_EXHAUSTED_CODE = 'model_provider_credit_exhausted';

export const PROVIDER_KEY_REFUSED_CODE = 'vendor_key_refused';

export const PROVIDER_CREDIT_NOTICE_TITLE = 'Neural Nexus needs your support.';

export const PROVIDER_CREDIT_NOTICE_BODY =
  'Replies are unavailable because the API has run out of funds.';

export const PROVIDER_CREDIT_SUPPORT_LABEL = 'Support';

export const PROVIDER_CREDIT_SUPPORT_REASON =
  'to sponsor Neural Nexus on GitHub';

export const PROVIDER_CREDIT_SUBSCRIBE_LABEL = 'Billing';

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
  'vendor_credits_exhausted',
  'used all of its available credits',
  'monthly spending limit',
  PROVIDER_CREDIT_EXHAUSTED_CODE,
];

// Snake_case vendor statuses for a refused operator key — not empty funds.
const VENDOR_KEY_REFUSED_MARKERS = [
  'invalid_api_key',
  'incorrect_api_key',
  'incorrect api key provided',
  'missing_api_key',
  PROVIDER_KEY_REFUSED_CODE,
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
    detail && typeof detail === 'object' ? detail.status : null,
    detail && typeof detail === 'object' ? detail.message : null,
  ]
    .filter((part) => typeof part === 'string' && part.trim())
    .join(' ')
    .toLowerCase();
}

/**
 * Whether this failure is the model or voice vendor refusing the call for
 * lack of credit, not the reader's allotment and not a refused API key.
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
  if (VENDOR_CREDIT_EXHAUSTED_MARKERS.some((marker) => text.includes(marker))) {
    return true;
  }
  return false;
}

/**
 * Whether this failure is the model or voice vendor refusing the operator's
 * API key, not empty funds and not the reader's allotment.
 *
 * @param {Error|null|undefined} requestError
 * @returns {boolean}
 */
export function isProviderKeyRefused(requestError) {
  if (!requestError) return false;
  if (isProviderCreditExhausted(requestError)) return false;
  if (requestError.code === PROVIDER_KEY_REFUSED_CODE) return true;
  const body = requestError.body;
  if (body && typeof body === 'object') {
    if (body.code === PROVIDER_KEY_REFUSED_CODE) return true;
    if (body.error === PROVIDER_KEY_REFUSED_CODE) return true;
    const detail = body.detail;
    if (detail && typeof detail === 'object') {
      if (detail.code === PROVIDER_KEY_REFUSED_CODE) return true;
      if (detail.error === PROVIDER_KEY_REFUSED_CODE) return true;
    }
  }
  const text = requestErrorText(requestError);
  return VENDOR_KEY_REFUSED_MARKERS.some((marker) => text.includes(marker));
}
