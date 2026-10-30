import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MICROPHONE_TAP_EXEMPT_ATTRIBUTE,
  isMicrophoneAccessRefused,
  microphonePromptCoversPage,
  pressMayAskForMicrophone,
  watchMicrophonePermission,
} from './microphonePermission.js';

test('a permission prompt refusal is a refused microphone', () => {
  assert.equal(
    isMicrophoneAccessRefused({ name: 'NotAllowedError' }),
    true
  );
  assert.equal(isMicrophoneAccessRefused({ name: 'AbortError' }), true);
});

test('a missing device or a secure-origin failure is not a refusal', () => {
  assert.equal(isMicrophoneAccessRefused({ name: 'NotFoundError' }), false);
  assert.equal(
    isMicrophoneAccessRefused({ name: 'NotSupportedError' }),
    false
  );
  assert.equal(isMicrophoneAccessRefused(null), false);
});

test('watchMicrophonePermission reports the current state and later changes', () => {
  const listeners = new Set();
  const status = {
    state: 'denied',
    addEventListener(type, listener) {
      if (type === 'change') listeners.add(listener);
    },
    removeEventListener(type, listener) {
      if (type === 'change') listeners.delete(listener);
    },
  };
  const seen = [];
  const stop = watchMicrophonePermission((state) => seen.push(state), status);
  assert.deepEqual(seen, ['denied']);
  status.state = 'granted';
  for (const listener of listeners) listener();
  assert.deepEqual(seen, ['denied', 'granted']);
  stop();
  status.state = 'prompt';
  for (const listener of listeners) listener();
  assert.deepEqual(seen, ['denied', 'granted']);
});

test('watchMicrophonePermission is a no-op when the query is missing', () => {
  const seen = [];
  const stop = watchMicrophonePermission((state) => seen.push(state), null);
  stop();
  assert.deepEqual(seen, []);
});

test('a coarse pointer means the microphone prompt covers the page', () => {
  assert.equal(
    microphonePromptCoversPage((query) => ({
      matches: query === '(pointer: coarse)',
    })),
    true
  );
  assert.equal(microphonePromptCoversPage(() => ({ matches: false })), false);
  assert.equal(microphonePromptCoversPage(null), false);
});

test('a press inside an exempt control does not ask for the microphone', () => {
  const exemptTarget = {
    closest: (selector) =>
      selector === `[${MICROPHONE_TAP_EXEMPT_ATTRIBUTE}]` ? {} : null,
  };
  const stageTarget = { closest: () => null };
  assert.equal(pressMayAskForMicrophone(exemptTarget), false);
  assert.equal(pressMayAskForMicrophone(stageTarget), true);
  assert.equal(pressMayAskForMicrophone(null), true);
});
