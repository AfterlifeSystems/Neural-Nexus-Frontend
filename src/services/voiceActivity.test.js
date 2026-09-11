import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  VOICE_ACTIVITY_MIN_SPEECH_PEAK,
  VOICE_ACTIVITY_MIN_SPEECH_RMS,
  VOICE_ACTIVITY_SPEECH_RMS_MARGIN,
  nextNoiseFloor,
  noiseFloorAfterRejectedUtterance,
  spectrumLooksLikeVoice,
  utteranceIsSendable,
  utteranceIsSpeech,
} from './voiceActivity.js';

test('room-tone peaks are not treated as speech', () => {
  assert.equal(
    utteranceIsSpeech({
      speechPeak: 0.025,
      rmsPeak: 0.03,
      noiseFloor: 0.02,
    }),
    false
  );
  assert.equal(
    utteranceIsSpeech({
      speechPeak: VOICE_ACTIVITY_MIN_SPEECH_PEAK - 0.001,
      rmsPeak: 0.08,
      noiseFloor: 0,
    }),
    false
  );
  assert.equal(
    utteranceIsSpeech({
      speechPeak: 0.2,
      rmsPeak: VOICE_ACTIVITY_MIN_SPEECH_RMS - 0.001,
      noiseFloor: 0,
    }),
    false
  );
});

test('a one-frame spike is not sent; a held voice band is', () => {
  const loud = {
    speechPeak: 0.2,
    rmsPeak: 0.08,
    noiseFloor: 0.02,
  };
  assert.equal(
    utteranceIsSendable({ ...loud, speechHoldMs: 40, voiceSpectrum: true }),
    false
  );
  assert.equal(
    utteranceIsSendable({ ...loud, speechHoldMs: 120, voiceSpectrum: false }),
    false
  );
  assert.equal(
    utteranceIsSendable({ ...loud, speechHoldMs: 120, voiceSpectrum: true }),
    true
  );
});

const binsFor = (fill) => {
  const bins = new Uint8Array(512);
  bins.fill(fill);
  return bins;
};

test('rumble-heavy spectra are not treated as voice; speech-band energy is', () => {
  const rumble = binsFor(8);
  for (let index = 1; index < 5; index += 1) rumble[index] = 80;
  assert.equal(spectrumLooksLikeVoice(rumble), false);
  const voice = binsFor(10);
  for (let index = 8; index < 70; index += 1) voice[index] = 40;
  assert.equal(spectrumLooksLikeVoice(voice), true);
});

test('a close-mic voice is treated as speech against the RMS floor', () => {
  assert.equal(
    utteranceIsSpeech({
      speechPeak: 0.2,
      rmsPeak: 0.08,
      noiseFloor: 0.02,
    }),
    true
  );
  assert.ok(0.08 >= 0.02 + VOICE_ACTIVITY_SPEECH_RMS_MARGIN);
});

test('speech still counts when ambient has already raised the RMS floor', () => {
  assert.equal(
    utteranceIsSpeech({
      speechPeak: 0.18,
      rmsPeak: 0.07,
      noiseFloor: 0.04,
    }),
    true
  );
});

test('a rejected clip nudges the RMS floor and cannot jump to a PCM peak', () => {
  const raised = noiseFloorAfterRejectedUtterance(0.02, 0.04);
  assert.ok(raised > 0.02);
  assert.ok(raised < 0.04);
  assert.equal(noiseFloorAfterRejectedUtterance(0.05, 0.04), 0.05);
  const afterVoicePeak = noiseFloorAfterRejectedUtterance(0.02, 0.4);
  assert.ok(
    afterVoicePeak < 0.08,
    'a PCM-sized value must not deafen the next sentence'
  );
});

test('quiet frames track the room; an open turn does not pull the floor up', () => {
  const quiet = nextNoiseFloor(0.02, 0.03, { speaking: false });
  assert.ok(quiet > 0.02);
  assert.ok(quiet < 0.03);
  assert.equal(
    nextNoiseFloor(0.02, 0.08, { speaking: true, clearlySpeech: false }),
    0.02
  );
  assert.equal(
    nextNoiseFloor(0.02, 0.2, { speaking: true, clearlySpeech: true }),
    0.02
  );
});
