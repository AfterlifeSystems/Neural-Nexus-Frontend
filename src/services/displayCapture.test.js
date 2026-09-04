import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canCaptureDisplay, requestDisplayMedia } from './displayCapture.js';

test('canCaptureDisplay is false when the picker API is missing', () => {
  const previousNavigator = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { mediaDevices: {} },
  });
  try {
    assert.equal(canCaptureDisplay(), false);
  } finally {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: previousNavigator,
    });
  }
});

test('canCaptureDisplay is true when getDisplayMedia exists', () => {
  const previousNavigator = globalThis.navigator;
  const getDisplayMedia = async () => ({});
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { mediaDevices: { getDisplayMedia } },
  });
  try {
    assert.equal(canCaptureDisplay(), true);
  } finally {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: previousNavigator,
    });
  }
});

test('requestDisplayMedia uses the mediaDevices picker', async () => {
  const previousNavigator = globalThis.navigator;
  const stream = { id: 'screen' };
  let receivedConstraints;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      mediaDevices: {
        getDisplayMedia: async (constraints) => {
          receivedConstraints = constraints;
          return stream;
        },
      },
    },
  });
  try {
    assert.equal(await requestDisplayMedia(), stream);
    assert.deepEqual(receivedConstraints, { video: true, audio: false });
  } finally {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: previousNavigator,
    });
  }
});
