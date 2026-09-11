import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CAMERA_FACING_FRONT,
  CAMERA_FACING_REAR,
  MOBILE_CAMERA_VIEW_QUERY,
  describeCameraFlip,
  facingFromTrackSettings,
  isMobileCameraView,
  openCameraStream,
  oppositeCameraFacing,
  videoConstraintsForFacing,
} from './cameraFacing.js';

test('oppositeCameraFacing swaps front and rear', () => {
  assert.equal(oppositeCameraFacing(CAMERA_FACING_REAR), CAMERA_FACING_FRONT);
  assert.equal(oppositeCameraFacing(CAMERA_FACING_FRONT), CAMERA_FACING_REAR);
  assert.equal(oppositeCameraFacing(undefined), CAMERA_FACING_FRONT);
});

test('videoConstraintsForFacing asks for the named camera without requiring it', () => {
  assert.deepEqual(videoConstraintsForFacing(CAMERA_FACING_FRONT), {
    facingMode: { ideal: CAMERA_FACING_FRONT },
  });
  assert.deepEqual(videoConstraintsForFacing(CAMERA_FACING_REAR), {
    facingMode: { ideal: CAMERA_FACING_REAR },
  });
  assert.deepEqual(videoConstraintsForFacing('unknown'), {
    facingMode: { ideal: CAMERA_FACING_REAR },
  });
});

test('facingFromTrackSettings treats a missing facing as the front camera', () => {
  assert.equal(
    facingFromTrackSettings({ facingMode: CAMERA_FACING_REAR }),
    CAMERA_FACING_REAR
  );
  assert.equal(
    facingFromTrackSettings({ facingMode: CAMERA_FACING_FRONT }),
    CAMERA_FACING_FRONT
  );
  assert.equal(facingFromTrackSettings({}), CAMERA_FACING_FRONT);
  assert.equal(facingFromTrackSettings(undefined), CAMERA_FACING_FRONT);
});

test('describeCameraFlip names the camera a press would open', () => {
  assert.equal(
    describeCameraFlip(CAMERA_FACING_REAR),
    'Switch to the front camera'
  );
  assert.equal(
    describeCameraFlip(CAMERA_FACING_FRONT),
    'Switch to the rear camera'
  );
});

test('isMobileCameraView follows the coarse-pointer or narrow-layout query', () => {
  assert.equal(isMobileCameraView(undefined), false);
  assert.equal(
    isMobileCameraView(() => ({ matches: true })),
    true
  );
  let seenQuery = '';
  isMobileCameraView((query) => {
    seenQuery = query;
    return { matches: false };
  });
  assert.equal(seenQuery, MOBILE_CAMERA_VIEW_QUERY);
});

test('openCameraStream asks getUserMedia for the named facing and no audio', async () => {
  const previousNavigator = globalThis.navigator;
  const opened = { id: 'cam' };
  let received = null;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      mediaDevices: {
        getUserMedia: async (constraints) => {
          received = constraints;
          return opened;
        },
      },
    },
  });
  try {
    const stream = await openCameraStream(CAMERA_FACING_FRONT);
    assert.equal(stream, opened);
    assert.deepEqual(received, {
      video: { facingMode: { ideal: CAMERA_FACING_FRONT } },
      audio: false,
    });
  } finally {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: previousNavigator,
    });
  }
});
