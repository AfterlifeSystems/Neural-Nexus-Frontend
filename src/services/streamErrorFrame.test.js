import assert from 'node:assert/strict';
import { test } from 'node:test';
import { streamErrorFromFrame } from './streamErrorFrame.js';

test('a 503 vendor-credit frame keeps the classified code', () => {
  const error = streamErrorFromFrame({
    type: 'error',
    status: 503,
    code: 'model_provider_credit_exhausted',
    message:
      "The avatar's model provider refused this reply because the service's credit with it is used up.",
  });
  assert.equal(error.status, 503);
  assert.equal(error.code, 'model_provider_credit_exhausted');
});

test('a 402 error frame becomes a billing refusal with the server sentence', () => {
  const error = streamErrorFromFrame({
    type: 'error',
    status: 402,
    code: 'allotment_exhausted',
    message: 'The monthly allotment is spent.',
  });
  assert.equal(error.status, 402);
  assert.equal(error.code, 'allotment_exhausted');
  assert.equal(error.message, 'The monthly allotment is spent.');
});

test('a frame with no sentence leaves the message empty for the fallback', () => {
  const error = streamErrorFromFrame({ type: 'error' });
  assert.equal(error.message, '');
  assert.equal(error.status, null);
  assert.equal(error.code, null);
});

test('detail is read when message is absent, and a non-integer status is dropped', () => {
  const error = streamErrorFromFrame({
    type: 'error',
    detail: '  The model refused.  ',
    status: 'bad',
  });
  assert.equal(error.message, 'The model refused.');
  assert.equal(error.status, null);
});

test('a missing frame still yields an error', () => {
  const error = streamErrorFromFrame(null);
  assert.equal(error.message, '');
  assert.deepEqual(error.body, {});
});
