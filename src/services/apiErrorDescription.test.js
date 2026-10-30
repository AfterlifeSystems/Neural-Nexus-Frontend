import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describeErrorBody } from './apiErrorDescription.js';

test('names the reason for each rejected upload item instead of the bare status', () => {
  const uploadRefusal = {
    detail: {
      message: 'No processable media found in the request; every item was rejected.',
      rejected: [
        {
          filename: 'https://medium.com/@shivon/an-older-article-0123456789ab',
          reason: 'Medium blocks automated reading of this article.',
          status_code: 400,
        },
      ],
    },
  };
  assert.equal(
    describeErrorBody(uploadRefusal, 400),
    'https://medium.com/@shivon/an-older-article-0123456789ab: Medium blocks automated reading of this article.',
  );
});

test('falls back to the refusal message when no item carries a reason', () => {
  const uploadRefusal = { detail: { message: 'No processable media found.', rejected: [] } };
  assert.equal(describeErrorBody(uploadRefusal, 400), 'No processable media found.');
});

test('keeps string details and the status fallback unchanged', () => {
  assert.equal(describeErrorBody({ detail: 'Plain refusal.' }, 400), 'Plain refusal.');
  assert.equal(describeErrorBody(null, 400), 'Request failed (400)');
});
