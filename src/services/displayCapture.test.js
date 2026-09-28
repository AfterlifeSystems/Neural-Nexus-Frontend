import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canCaptureDisplay,
  createSingleFlightRequest,
  requestDisplayMedia,
} from './displayCapture.js';

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

test('createSingleFlightRequest opens one picker for presses made while the picker is open', async () => {
  let pickerOpenCount = 0;
  let resolvePicker;
  const stream = { id: 'screen' };
  const openPickerOnce = createSingleFlightRequest(() => {
    pickerOpenCount += 1;
    return new Promise((resolve) => {
      resolvePicker = resolve;
    });
  });

  const firstPress = openPickerOnce();
  const secondPress = openPickerOnce();
  assert.equal(pickerOpenCount, 1);
  assert.equal(firstPress, secondPress);

  resolvePicker(stream);
  assert.equal(await firstPress, stream);
  assert.equal(await secondPress, stream);
});

test('createSingleFlightRequest starts the request inside the press', () => {
  let pickerOpenCount = 0;
  const openPickerOnce = createSingleFlightRequest(async () => {
    pickerOpenCount += 1;
    return {};
  });
  openPickerOnce();
  assert.equal(pickerOpenCount, 1);
});

test('createSingleFlightRequest opens a new picker after the previous picker settles', async () => {
  let pickerOpenCount = 0;
  const openPickerOnce = createSingleFlightRequest(async () => {
    pickerOpenCount += 1;
    if (pickerOpenCount === 1) {
      const cancelError = new Error('The person closed the picker.');
      cancelError.name = 'NotAllowedError';
      throw cancelError;
    }
    return { id: 'screen' };
  });

  await assert.rejects(openPickerOnce(), { name: 'NotAllowedError' });
  assert.deepEqual(await openPickerOnce(), { id: 'screen' });
  assert.equal(pickerOpenCount, 2);
});

test('createSingleFlightRequest rejects when the request throws before starting', async () => {
  let pickerOpenCount = 0;
  const openPickerOnce = createSingleFlightRequest(() => {
    pickerOpenCount += 1;
    const unsupportedError = new Error('This browser cannot share the screen.');
    unsupportedError.name = 'NotSupportedError';
    throw unsupportedError;
  });

  await assert.rejects(openPickerOnce(), { name: 'NotSupportedError' });
  await assert.rejects(openPickerOnce(), { name: 'NotSupportedError' });
  assert.equal(pickerOpenCount, 2);
});
