import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PROVIDER_CREDIT_EXHAUSTED_CODE,
  isProviderCreditExhausted,
} from './providerCreditExhausted.js';

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
