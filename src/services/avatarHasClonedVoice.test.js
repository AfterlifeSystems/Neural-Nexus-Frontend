import assert from 'node:assert/strict';
import { test } from 'node:test';
import { avatarHasClonedVoice } from './avatarHasClonedVoice.js';

test('a missing or empty voice record is not a clone', () => {
  assert.equal(avatarHasClonedVoice(null), false);
  assert.equal(avatarHasClonedVoice(undefined), false);
  assert.equal(avatarHasClonedVoice({}), false);
});

test('an instant or professional clone counts', () => {
  assert.equal(avatarHasClonedVoice({ instant_voice_id: 'ivc_1' }), true);
  assert.equal(
    avatarHasClonedVoice({ professional_voice_id: 'pvc_1' }),
    true
  );
  assert.equal(avatarHasClonedVoice({ active_voice: 'instant' }), true);
  assert.equal(avatarHasClonedVoice({ active_voice: 'professional' }), true);
});

test('a chosen standard voice is not a clone', () => {
  assert.equal(
    avatarHasClonedVoice({
      has_voice: true,
      active_voice: 'standard',
      standard_voice: { voice_id: 'rachel' },
    }),
    false
  );
  assert.equal(
    avatarHasClonedVoice({
      has_voice: true,
      standard_voice: { voice_id: 'rachel' },
    }),
    false
  );
  assert.equal(avatarHasClonedVoice({ active_voice: 'none' }), false);
});

test('a banned clone does not count even when a stock voice stands in', () => {
  assert.equal(
    avatarHasClonedVoice({
      instant_voice_id: 'ivc_1',
      instant_voice_blocked: true,
      has_voice: true,
      active_voice: 'standard',
    }),
    false
  );
  assert.equal(
    avatarHasClonedVoice({
      instant_voice_id: 'ivc_1',
      blocked: true,
    }),
    false
  );
});

test('a clone behind a chosen standard voice is still a clone', () => {
  // Readiness reports the voice that speaks, which is the standard voice when
  // the owner chose one; the clone is still there to switch back to.
  assert.equal(
    avatarHasClonedVoice({
      active_voice: 'standard',
      has_voice: true,
      custom_voice_available: true,
    }),
    true
  );
});
