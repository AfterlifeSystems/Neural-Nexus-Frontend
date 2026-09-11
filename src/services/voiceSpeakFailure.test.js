import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  speakFailureKind,
  speakFailureReason,
} from './voiceSpeakFailure.js';

test('the server sentence is the reason shown for a plain failure', () => {
  assert.equal(
    speakFailureReason({
      status: 502,
      message: 'The voice vendor returned an error.',
    }),
    'The voice vendor returned an error.'
  );
  assert.equal(
    speakFailureReason({
      status: 500,
      message: 'Request failed (500)',
      body: { detail: 'The clone is still uploading.' },
    }),
    'The clone is still uploading.'
  );
});

test('a fallback description or a network error is not worth repeating', () => {
  assert.equal(speakFailureReason({ message: 'Request failed (502)' }), '');
  assert.equal(speakFailureReason({ message: '502' }), '');
  assert.equal(speakFailureReason({ message: 'Failed to fetch' }), '');
  assert.equal(speakFailureReason(null), '');
});

test('a long reason is cut to fit a toast', () => {
  const reason = speakFailureReason({ message: 'x'.repeat(400) });
  assert.ok(reason.length <= 160);
  assert.ok(reason.endsWith('…'));
});

test('a voice that has not been uploaded is not_ready, not blocked', () => {
  assert.equal(
    speakFailureKind({
      status: 409,
      body: {
        error: 'voice_not_ready',
        detail: 'This avatar has no cloned voice yet. Record about two minutes.',
        collected_seconds: 0,
        instant_minimum_seconds: 60,
      },
    }),
    'not_ready'
  );
});

test('a banned clone is blocked, not a missing upload', () => {
  assert.equal(
    speakFailureKind({
      status: 409,
      body: {
        error: 'voice_blocked',
        detail:
          "ElevenLabs has blocked this avatar's cloned voice for violating its terms of service.",
      },
    }),
    'blocked'
  );
});

test('blocked wins when the sentence mentions a ban without a code', () => {
  assert.equal(
    speakFailureKind({
      status: 409,
      message: 'ElevenLabs has blocked this voice for violating its terms of service.',
      body: { detail: 'ElevenLabs has blocked this voice.' },
    }),
    'blocked'
  );
});

test('a 409 without a code is a missing voice model, not a generic failure', () => {
  assert.equal(
    speakFailureKind({
      status: 409,
      message: 'Conflict',
      body: { detail: 'Conflict' },
    }),
    'not_ready'
  );
});

test('no voice model in the sentence is not_ready', () => {
  assert.equal(
    speakFailureKind({
      status: 409,
      message: 'This avatar has no voice model yet.',
      body: { detail: 'This avatar has no voice model yet.' },
    }),
    'not_ready'
  );
});

test('voice features not configured is unavailable, not a missing voice model', () => {
  assert.equal(
    speakFailureKind({
      status: 503,
      message: 'Voice features are not configured.',
      body: { detail: 'Voice features are not configured.' },
    }),
    'unavailable'
  );
});

test('collected seconds nested under detail mean no clone yet', () => {
  assert.equal(
    speakFailureKind({
      status: 409,
      body: {
        detail: { collected_seconds: 8, instant_minimum_seconds: 60 },
      },
    }),
    'not_ready'
  );
});

test('a vendor failure is not a missing voice model', () => {
  assert.equal(
    speakFailureKind({
      status: 502,
      message: 'ElevenLabs rejected the request (voice_id not found)',
      body: { detail: 'ElevenLabs rejected the request (voice_id not found)' },
    }),
    'failed'
  );
});

test('collected seconds without a blocked code mean no clone yet', () => {
  assert.equal(
    speakFailureKind({
      status: 409,
      body: { collected_seconds: 12, instant_minimum_seconds: 60 },
    }),
    'not_ready'
  );
});

test('a blocked code is still blocked even if seconds were collected', () => {
  assert.equal(
    speakFailureKind({
      status: 409,
      body: {
        error: 'voice_blocked',
        collected_seconds: 90,
      },
    }),
    'blocked'
  );
});

test('a spent allotment is billing', () => {
  assert.equal(speakFailureKind({ status: 402, message: 'Payment required' }), 'billing');
});
