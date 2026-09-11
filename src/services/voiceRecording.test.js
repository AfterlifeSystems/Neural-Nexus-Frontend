import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MICROPHONE_AUDIO_CONSTRAINTS,
  PcmPreRoll,
  VOICE_PRE_ROLL_MS,
  WAV_SAMPLE_RATE,
  concatFloat32,
  encodePcmToWav,
  needsSilentDestinationTap,
  pcmPeakAbs,
  resampleLinear,
  wavFileFromPcmChunks,
} from './voiceRecording.js';

const readAscii = (view, offset, length) =>
  String.fromCharCode(
    ...Array.from({ length }, (_, index) => view.getUint8(offset + index))
  );

test('microphone constraints ask for mono without requiring a sample rate', () => {
  // An exact sampleRate constraint fails getUserMedia on some phones.
  assert.deepEqual(MICROPHONE_AUDIO_CONSTRAINTS.channelCount, { ideal: 1 });
  assert.equal(MICROPHONE_AUDIO_CONSTRAINTS.sampleRate, undefined);
  assert.equal(MICROPHONE_AUDIO_CONSTRAINTS.echoCancellation, true);
});

test('concatFloat32 joins frames in order', () => {
  const joined = concatFloat32([
    Float32Array.from([0, 0.5]),
    Float32Array.from([-0.5]),
  ]);
  assert.deepEqual([...joined], [0, 0.5, -0.5]);
});

test('resampleLinear downsamples 48 kHz to Whisper native 16 kHz', () => {
  const input = new Float32Array(480);
  for (let index = 0; index < input.length; index += 1) {
    input[index] = index;
  }
  const out = resampleLinear(input, 48_000, WAV_SAMPLE_RATE);
  assert.equal(out.length, 160);
  assert.equal(out[0], 0);
  assert.ok(Math.abs(out[1] - 3) < 0.01);
});

test('encodePcmToWav writes a 16-bit mono WAVE header at 16 kHz', () => {
  const samples = Float32Array.from([0, 1, -1, 0.5]);
  const buffer = encodePcmToWav(samples, WAV_SAMPLE_RATE);
  const view = new DataView(buffer);
  assert.equal(readAscii(view, 0, 4), 'RIFF');
  assert.equal(readAscii(view, 8, 4), 'WAVE');
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint32(24, true), WAV_SAMPLE_RATE);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal(view.getInt16(44, true), 0);
  assert.equal(view.getInt16(46, true), 32767);
  assert.equal(view.getInt16(48, true), -32768);
});

test('wavFileFromPcmChunks is audio/wav at 16 kHz, never webm or mp4', async () => {
  const frame = new Float32Array(4800);
  for (let index = 0; index < frame.length; index += 1) {
    frame[index] = Math.sin(index / 10);
  }
  const file = wavFileFromPcmChunks([frame], 48_000, 'utterance.wav');
  assert.equal(file.type, 'audio/wav');
  assert.equal(file.name, 'utterance.wav');
  assert.equal(file.name.endsWith('.webm'), false);
  assert.equal(file.name.endsWith('.m4a'), false);
  const bytes = await file.arrayBuffer();
  const view = new DataView(bytes);
  assert.equal(view.getUint32(24, true), WAV_SAMPLE_RATE);
  assert.ok(file.size > 44);
});

test('wavFileFromPcmChunks can keep the native rate for clone recordings', async () => {
  const frame = new Float32Array(480);
  frame[0] = 0.25;
  const file = wavFileFromPcmChunks([frame], 48_000, 'voice-turn.wav', 48_000);
  const view = new DataView(await file.arrayBuffer());
  assert.equal(view.getUint32(24, true), 48_000);
  assert.equal(view.getUint32(40, true), 480 * 2);
});

test('wavFileFromPcmChunks is null when nothing was captured', () => {
  assert.equal(wavFileFromPcmChunks([], 48_000), null);
  assert.equal(wavFileFromPcmChunks([new Float32Array(0)], 48_000), null);
});

test('PcmPreRoll keeps only the last 300 ms so a late VAD still has the onset', () => {
  const sampleRate = 16_000;
  const roll = new PcmPreRoll(sampleRate, VOICE_PRE_ROLL_MS);
  // Five 100 ms frames: 500 ms in, 300 ms kept.
  for (let frameIndex = 0; frameIndex < 5; frameIndex += 1) {
    const frame = new Float32Array(1600);
    frame.fill(frameIndex + 1);
    roll.push(frame);
  }
  assert.equal(roll.sampleCount, 4800);
  const snapshot = roll.snapshot();
  const samples = concatFloat32(snapshot);
  assert.equal(samples.length, 4800);
  // The oldest 200 ms (value 1, then part of 2) must be gone; the window
  // starts in the frame filled with 3.
  assert.equal(samples[0], 3);
  assert.equal(samples[samples.length - 1], 5);
  // Snapshot is a copy: later pushes must not mutate a frozen turn.
  roll.push(Float32Array.from({ length: 1600 }, () => 9));
  assert.equal(samples[samples.length - 1], 5);
});

test('pcmPeakAbs is the largest magnitude in the frame', () => {
  assert.equal(pcmPeakAbs(Float32Array.from([0.25, -0.5, 0.125])), 0.5);
  assert.equal(pcmPeakAbs(new Float32Array(0)), 0);
});

test('needsSilentDestinationTap is iOS WebKit only', () => {
  assert.equal(
    needsSilentDestinationTap(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'
    ),
    true
  );
  assert.equal(
    needsSilentDestinationTap(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ),
    false
  );
});
