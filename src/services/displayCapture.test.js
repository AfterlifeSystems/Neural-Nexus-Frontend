import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canCaptureDisplay,
  createSharedScreenCapture,
  createSingleFlightRequest,
  requestDisplayMedia,
} from './displayCapture.js';

function createFakeScreenStream() {
  const endedListeners = [];
  const videoTrack = {
    readyState: 'live',
    stopCount: 0,
    stop() {
      videoTrack.stopCount += 1;
      videoTrack.readyState = 'ended';
    },
    addEventListener(eventName, listener) {
      if (eventName === 'ended') endedListeners.push(listener);
    },
    endFromBrowser() {
      videoTrack.readyState = 'ended';
      endedListeners.forEach((listener) => listener());
    },
  };
  return {
    videoTrack,
    getVideoTracks: () => [videoTrack],
    getTracks: () => [videoTrack],
  };
}

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

test('a second holder reuses the live screen capture without a second picker', async () => {
  let pickerOpenCount = 0;
  const screenCapture = createSharedScreenCapture(async () => {
    pickerOpenCount += 1;
    return createFakeScreenStream();
  });

  const sidebarStream = await screenCapture.acquire('sidebar');
  const overlayStream = await screenCapture.acquire('overlay');
  assert.equal(pickerOpenCount, 1);
  assert.equal(sidebarStream, overlayStream);
});

test('holders acquiring while the picker is open join the open picker', async () => {
  let pickerOpenCount = 0;
  let resolvePicker;
  const screenCapture = createSharedScreenCapture(() => {
    pickerOpenCount += 1;
    return new Promise((resolve) => {
      resolvePicker = resolve;
    });
  });

  const sidebarRequest = screenCapture.acquire('sidebar');
  const overlayRequest = screenCapture.acquire('overlay');
  assert.equal(pickerOpenCount, 1);
  const stream = createFakeScreenStream();
  resolvePicker(stream);
  assert.equal(await sidebarRequest, stream);
  assert.equal(await overlayRequest, stream);
});

test('the screen capture stops only when the last holder releases the capture', async () => {
  const screenCapture = createSharedScreenCapture(async () =>
    createFakeScreenStream()
  );
  const stream = await screenCapture.acquire('sidebar');
  await screenCapture.acquire('overlay');

  screenCapture.release('overlay');
  assert.equal(stream.videoTrack.stopCount, 0);
  screenCapture.release('sidebar');
  assert.equal(stream.videoTrack.stopCount, 1);
});

test('a screen capture the browser ended opens a new picker on the next acquire', async () => {
  let pickerOpenCount = 0;
  const screenCapture = createSharedScreenCapture(async () => {
    pickerOpenCount += 1;
    return createFakeScreenStream();
  });
  const firstStream = await screenCapture.acquire('sidebar');
  firstStream.videoTrack.endFromBrowser();

  const secondStream = await screenCapture.acquire('overlay');
  assert.equal(pickerOpenCount, 2);
  assert.notEqual(firstStream, secondStream);
});

test('a released screen capture opens a new picker on the next acquire', async () => {
  let pickerOpenCount = 0;
  const screenCapture = createSharedScreenCapture(async () => {
    pickerOpenCount += 1;
    return createFakeScreenStream();
  });
  await screenCapture.acquire('sidebar');
  screenCapture.release('sidebar');
  await screenCapture.acquire('sidebar');
  assert.equal(pickerOpenCount, 2);
});
