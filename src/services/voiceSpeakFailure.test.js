import assert from 'node:assert/strict';
import { test } from 'node:test';
import { speakFailureKind } from './voiceSpeakFailure.js';

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

test('a 409 without a code is not assumed to be an upload that never happened', () => {
  assert.equal(
    speakFailureKind({
      status: 409,
      message: 'Conflict',
      body: { detail: 'Conflict' },
    }),
    'failed'
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
