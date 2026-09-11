import assert from 'node:assert/strict';
import { test } from 'node:test';

import { canCaptureMicrophone } from './voiceSession.js';

test('canCaptureMicrophone needs getUserMedia and an AudioContext, not MediaRecorder', () => {
  const previousNavigator = globalThis.navigator;
  const previousAudioContext = globalThis.AudioContext;
  const previousWebkit = globalThis.webkitAudioContext;
  const previousMediaRecorder = globalThis.MediaRecorder;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { mediaDevices: { getUserMedia: async () => ({}) } },
  });
  globalThis.AudioContext = function AudioContext() {};
  delete globalThis.webkitAudioContext;
  delete globalThis.MediaRecorder;
  try {
    assert.equal(canCaptureMicrophone(), true);
  } finally {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: previousNavigator,
    });
    globalThis.AudioContext = previousAudioContext;
    globalThis.webkitAudioContext = previousWebkit;
    globalThis.MediaRecorder = previousMediaRecorder;
  }
});

test('canCaptureMicrophone is false without an AudioContext', () => {
  const previousNavigator = globalThis.navigator;
  const previousAudioContext = globalThis.AudioContext;
  const previousWebkit = globalThis.webkitAudioContext;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { mediaDevices: { getUserMedia: async () => ({}) } },
  });
  delete globalThis.AudioContext;
  delete globalThis.webkitAudioContext;
  try {
    assert.equal(canCaptureMicrophone(), false);
  } finally {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: previousNavigator,
    });
    globalThis.AudioContext = previousAudioContext;
    globalThis.webkitAudioContext = previousWebkit;
  }
});
