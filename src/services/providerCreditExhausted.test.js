import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PROVIDER_CREDIT_EXHAUSTED_CODE,
  PROVIDER_CREDIT_NOTICE_BODY,
  PROVIDER_CREDIT_NOTICE_TITLE,
  PROVIDER_CREDIT_SUBSCRIBE_LABEL,
  PROVIDER_CREDIT_SUPPORT_LABEL,
  PROVIDER_CREDIT_SUPPORT_REASON,
  isProviderCreditExhausted,
} from './providerCreditExhausted.js';

test('the notice asks the reader to support Neural Nexus rather than wait out a fault', () => {
  assert.match(PROVIDER_CREDIT_NOTICE_TITLE, /support/i);
  assert.match(PROVIDER_CREDIT_NOTICE_BODY, /funds/i);
  assert.doesNotMatch(PROVIDER_CREDIT_NOTICE_TITLE, /technical difficulties/i);
  assert.equal(PROVIDER_CREDIT_SUPPORT_LABEL, 'Support');
  assert.match(PROVIDER_CREDIT_SUPPORT_REASON, /GitHub/);
  assert.equal(PROVIDER_CREDIT_SUBSCRIBE_LABEL, 'Billing');
});

test('the stream error code is the classified refusal', () => {
  assert.equal(
    isProviderCreditExhausted({
      status: 503,
      code: PROVIDER_CREDIT_EXHAUSTED_CODE,
      message: 'The avatar\'s model provider refused this reply.',
    }),
    true
  );
});

test('the same code on the parsed body is recognised', () => {
  assert.equal(
    isProviderCreditExhausted({
      status: 503,
      message: 'Request failed (503)',
      body: { code: PROVIDER_CREDIT_EXHAUSTED_CODE },
    }),
    true
  );
  assert.equal(
    isProviderCreditExhausted({
      status: 503,
      message: 'Request failed (503)',
      body: { error: PROVIDER_CREDIT_EXHAUSTED_CODE },
    }),
    true
  );
  assert.equal(
    isProviderCreditExhausted({
      status: 503,
      message: 'Request failed (503)',
      body: { detail: { error: PROVIDER_CREDIT_EXHAUSTED_CODE } },
    }),
    true
  );
});

test('a raw vendor quota sentence is recognised when the code is missing', () => {
  assert.equal(
    isProviderCreditExhausted({
      status: 429,
      message: 'Error code: 429 - insufficient_quota: You exceeded your current quota',
    }),
    true
  );
  assert.equal(
    isProviderCreditExhausted({
      message: 'The credit balance is too low to run this request.',
    }),
    true
  );
});

test('a spent reader allotment is not this refusal', () => {
  assert.equal(
    isProviderCreditExhausted({
      status: 402,
      code: 'allotment_exhausted',
      message: 'The monthly allotment is spent.',
    }),
    false
  );
});

test('an ordinary failure and a missing error are not this refusal', () => {
  assert.equal(
    isProviderCreditExhausted({
      status: 500,
      code: 'turn_failed',
      message: 'The avatar could not finish that reply.',
    }),
    false
  );
  assert.equal(isProviderCreditExhausted({ status: 503, message: 'Unavailable' }), false);
  assert.equal(isProviderCreditExhausted(null), false);
});

test('a nested vendor status on the body is recognised', () => {
  assert.equal(
    isProviderCreditExhausted({
      status: 502,
      message: 'Request failed (502)',
      body: { detail: { status: 'invalid_api_key', message: 'Invalid API key' } },
    }),
    true
  );
});

test('ElevenLabs, OpenAI, and xAI key or credit refusals are this pause', () => {
  assert.equal(
    isProviderCreditExhausted({
      status: 502,
      message:
        'ElevenLabs rejected the request (401 invalid_api_key: Invalid API key)',
    }),
    true
  );
  assert.equal(
    isProviderCreditExhausted({
      status: 401,
      message: 'Error code: 401 - Incorrect API key provided',
    }),
    true
  );
  assert.equal(
    isProviderCreditExhausted({
      status: 401,
      message: 'openai.AuthenticationError: Error code: 401 - invalid_api_key',
    }),
    true
  );
  assert.equal(
    isProviderCreditExhausted({
      status: 403,
      code: 'vendor_credits_exhausted',
      message:
        'xAI refused every generation: the xAI team has used all of its available credits.',
    }),
    true
  );
  assert.equal(
    isProviderCreditExhausted({
      status: 403,
      message: 'xAI permission-denied: the xAI team has reached its monthly spending limit.',
    }),
    true
  );
});

test('a Neural Nexus session 401 is not a vendor-credit pause', () => {
  assert.equal(
    isProviderCreditExhausted({
      status: 401,
      message: 'Invalid API key',
    }),
    false
  );
});

test('an ElevenLabs voice-id miss or a blocked clone is not a vendor-credit pause', () => {
  assert.equal(
    isProviderCreditExhausted({
      status: 502,
      message: 'ElevenLabs rejected the request (voice_id not found)',
    }),
    false
  );
  assert.equal(
    isProviderCreditExhausted({
      status: 403,
      message:
        'ElevenLabs rejected the request (403 detected_blocked_voice: This voice is blocked)',
    }),
    false
  );
});
