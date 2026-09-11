// src/services/voiceRecording.js
//
// Microphone capture for transcription.
//
// MediaRecorder is a poor fit for this. Chromium writes WebM/Opus; Safari and
// every iOS browser (Chrome included — they all use WebKit) write AAC in MP4.
// Whisper hallucinates on those Safari files: clipped words, invented captions
// such as Korean news sign-offs, "Thank you for watching". The API already
// filters the worst of those captions, but the remaining transcript is still
// the wrong words. The well-known `MediaRecorder.start(1000)` workaround still
// concatenates fragmented MP4, and live listening started the recorder 120 ms
// *after* speech began, so phones also lost the onset of every turn.
//
// This module reads PCM from the Web Audio graph, keeps a short pre-roll so
// the first consonants survive voice-activity detection, and encodes 16 kHz
// mono WAV — the format the speech model is trained on, and one ffmpeg on the
// server already accepts.

export const MICROPHONE_AUDIO_CONSTRAINTS = {
  channelCount: { ideal: 1 },
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

/** Whisper's native rate. A 10 s turn is ~320 KB instead of ~1 MB at 48 kHz. */
export const WAV_SAMPLE_RATE = 16_000;

/** How much audio before the VAD trigger is kept, so the onset is in the file. */
export const VOICE_PRE_ROLL_MS = 300;

const WAV_CHANNELS = 1;
const WAV_BITS_PER_SAMPLE = 16;
const SCRIPT_PROCESSOR_BUFFER = 4096;

const writeAscii = (view, offset, text) => {
  for (let index = 0; index < text.length; index += 1) {
    view.setUint8(offset + index, text.charCodeAt(index));
  }
};

/**
 * Peak absolute amplitude of a PCM frame.
 *
 * @param {Float32Array|ArrayLike<number>} samples
 * @returns {number}
 */
export function pcmPeakAbs(samples) {
  let peak = 0;
  for (let index = 0; index < (samples?.length ?? 0); index += 1) {
    const magnitude = Math.abs(samples[index]);
    if (magnitude > peak) peak = magnitude;
  }
  return peak;
}

/**
 * Concatenate PCM frames into one buffer.
 *
 * @param {Float32Array[]} chunks
 * @returns {Float32Array}
 */
export function concatFloat32(chunks) {
  let length = 0;
  for (const chunk of chunks) length += chunk.length;
  const out = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/**
 * Linear resample. 48 kHz → 16 kHz is the usual phone path; 44.1 kHz is
 * Safari's AudioContext default.
 *
 * @param {Float32Array} input
 * @param {number} fromRate
 * @param {number} toRate
 * @returns {Float32Array}
 */
export function resampleLinear(input, fromRate, toRate) {
  if (!input.length) return input;
  if (!fromRate || !toRate || fromRate === toRate) return input;
  const outLength = Math.max(1, Math.round((input.length * toRate) / fromRate));
  const out = new Float32Array(outLength);
  const ratio = fromRate / toRate;
  const last = input.length - 1;
  for (let index = 0; index < outLength; index += 1) {
    const source = index * ratio;
    const left = Math.min(Math.floor(source), last);
    const right = Math.min(left + 1, last);
    const fraction = source - left;
    out[index] = input[left] * (1 - fraction) + input[right] * fraction;
  }
  return out;
}

/**
 * Encode mono float PCM as a 16-bit WAV buffer.
 *
 * @param {Float32Array} samples
 * @param {number} sampleRate
 * @returns {ArrayBuffer}
 */
export function encodePcmToWav(samples, sampleRate) {
  const frameCount = samples.length;
  const dataSize = frameCount * WAV_CHANNELS * (WAV_BITS_PER_SAMPLE / 8);
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, WAV_CHANNELS, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * WAV_CHANNELS * (WAV_BITS_PER_SAMPLE / 8), true);
  view.setUint16(32, WAV_CHANNELS * (WAV_BITS_PER_SAMPLE / 8), true);
  view.setUint16(34, WAV_BITS_PER_SAMPLE, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  let offset = 44;
  for (let index = 0; index < frameCount; index += 1) {
    const clipped = Math.max(-1, Math.min(1, samples[index] ?? 0));
    view.setInt16(offset, clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff, true);
    offset += 2;
  }
  return buffer;
}

/**
 * Build the File POST /transcribe and spoken turns attach.
 *
 * Live utterances default to 16 kHz (Whisper's rate, small enough to upload
 * often). Push-to-talk and voice-clone takes pass the AudioContext rate so
 * a script recording is not downsampled to telephone quality.
 *
 * @param {Float32Array[]} chunks
 * @param {number} sourceSampleRate
 * @param {string} [filename]
 * @param {number} [targetSampleRate]
 * @returns {File|null}
 */
export function wavFileFromPcmChunks(
  chunks,
  sourceSampleRate,
  filename = 'utterance.wav',
  targetSampleRate = WAV_SAMPLE_RATE
) {
  if (!chunks?.length) return null;
  const combined = concatFloat32(chunks);
  if (!combined.length) return null;
  const rate = targetSampleRate || WAV_SAMPLE_RATE;
  const samples = resampleLinear(combined, sourceSampleRate, rate);
  return new File([encodePcmToWav(samples, rate)], filename, {
    type: 'audio/wav',
  });
}

/**
 * A rolling window of the last `preRollMs` of PCM, so a VAD that opens a
 * turn late still has the consonants that started it.
 */
export class PcmPreRoll {
  /**
   * @param {number} sampleRate
   * @param {number} [preRollMs]
   */
  constructor(sampleRate, preRollMs = VOICE_PRE_ROLL_MS) {
    this.sampleRate = sampleRate;
    this.maxSamples = Math.max(1, Math.ceil((sampleRate * preRollMs) / 1000));
    this.chunks = [];
    this.samples = 0;
  }

  /**
   * @param {Float32Array|ArrayLike<number>} frame
   */
  push(frame) {
    if (!frame?.length) return;
    const copy = frame instanceof Float32Array ? new Float32Array(frame) : Float32Array.from(frame);
    this.chunks.push(copy);
    this.samples += copy.length;
    while (this.samples > this.maxSamples && this.chunks.length > 1) {
      const dropped = this.chunks.shift();
      this.samples -= dropped.length;
    }
    if (this.samples > this.maxSamples && this.chunks[0]) {
      const extra = this.samples - this.maxSamples;
      this.chunks[0] = this.chunks[0].subarray(extra);
      this.samples -= extra;
    }
  }

  /** @returns {Float32Array[]} */
  snapshot() {
    return this.chunks.map((chunk) => new Float32Array(chunk));
  }

  get sampleCount() {
    return this.samples;
  }
}

/**
 * Tap PCM off a MediaStreamAudioSourceNode.
 *
 * Output goes to a MediaStreamDestination, not the speakers. Routing a mute
 * gain into `audioContext.destination` made some browsers treat the page as
 * playing audio, which pumped auto-gain and turned room tone into "speech".
 * iOS ScriptProcessor only fires when the graph reaches the real destination,
 * so a silent tap is added there on iPhone/iPad only.
 *
 * @param {AudioContext} audioContext
 * @param {MediaStreamAudioSourceNode} source
 * @param {(frame: Float32Array) => void} onFrame
 * @returns {{stop: function(): void}}
 */
export function attachPcmTap(audioContext, source, onFrame) {
  const processor = audioContext.createScriptProcessor(
    SCRIPT_PROCESSOR_BUFFER,
    1,
    1
  );
  const sink = audioContext.createMediaStreamDestination();
  processor.onaudioprocess = (event) => {
    const channel = event.inputBuffer.getChannelData(0);
    if (channel?.length) onFrame(channel);
  };
  source.connect(processor);
  processor.connect(sink);
  let mute = null;
  if (needsSilentDestinationTap()) {
    mute = audioContext.createGain();
    mute.gain.value = 0;
    processor.connect(mute);
    mute.connect(audioContext.destination);
  }
  return {
    processor,
    stop: () => {
      processor.onaudioprocess = null;
      try {
        source.disconnect(processor);
      } catch {
        // Already disconnected.
      }
      try {
        processor.disconnect();
      } catch {
        // Already disconnected.
      }
      try {
        mute?.disconnect();
      } catch {
        // Already disconnected.
      }
    },
  };
}

/**
 * iOS WebKit does not run ScriptProcessor unless it reaches destination.
 *
 * @param {string} [userAgent]
 * @returns {boolean}
 */
export function needsSilentDestinationTap(
  userAgent = globalThis.navigator?.userAgent ?? ''
) {
  return /iP(ad|hone|od)/i.test(userAgent);
}

/**
 * @param {AudioContext} audioContext
 * @returns {Promise<AudioContext>}
 */
export async function resumeAudioContext(audioContext) {
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }
  return audioContext;
}

/**
 * @returns {Promise<MediaStream>}
 */
export function openMicrophoneStream() {
  return navigator.mediaDevices.getUserMedia({
    audio: MICROPHONE_AUDIO_CONSTRAINTS,
  });
}
