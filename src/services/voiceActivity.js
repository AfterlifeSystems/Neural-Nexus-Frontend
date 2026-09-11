// src/services/voiceActivity.js
//
// Turn-based live listening: notice when the person starts speaking, record
// until they stop, hand the utterance over, and listen again.
//
// Detection is energy-based and done in the browser: an AnalyserNode reads the
// microphone's RMS level, a noise floor is calibrated from the first half
// second, and speech is "on" once the level exceeds the floor by a margin for
// long enough and "off" once it falls back for long enough. That is deliberate:
// a model-based detector would add an ONNX runtime to the bundle for a gain
// this screen does not need. The module exposes start/stop/pause/resume so a
// model-based detector can replace it behind the same surface later.
//
// Recording is PCM → 16 kHz WAV, not MediaRecorder. Safari/iOS writes AAC in
// MP4 that Whisper transcribes badly, and starting the recorder at the VAD
// trigger dropped the first consonants on phones (MediaRecorder itself is also
// slow to start there). A rolling pre-roll keeps the onset.
//
// Room tone that sits just above the calibrated floor used to look like an
// endless turn: Whisper captioned the noise, and the avatar answered it. A
// later gate then mixed PCM peaks into that RMS floor, so a rejected clip
// (or a short word) raised the floor to voice amplitude and the next sentence
// never opened a turn — "great" vanished, and "Do you hear me now?" arrived
// as "to hear me now" because only the loud middle crossed the inflated
// floor. The floor stays in RMS units; rejected ambient nudges it a little,
// never to a PCM peak; the speech test uses the floor from when the turn
// opened, so a noisy stretch cannot talk itself out of being heard.
//
// The caller decides when this listens. Live voice mode pauses it for the
// whole of a spoken reply: everything a speaker plays is something this
// module would otherwise hear, transcribe, and hand back as a turn, which is
// how an avatar ends up answering its own last sentence.

import {
  PcmPreRoll,
  attachPcmTap,
  openMicrophoneStream,
  pcmPeakAbs,
  resumeAudioContext,
  wavFileFromPcmChunks,
} from './voiceRecording.js';

// Tunables. Milliseconds unless noted.
export const VOICE_ACTIVITY_CALIBRATION_MS = 500;
export const VOICE_ACTIVITY_START_MS = 140; // sustained speech before a turn opens
export const VOICE_ACTIVITY_END_MS = 700; // sustained silence before a turn closes
export const VOICE_ACTIVITY_MARGIN = 0.016; // RMS above the noise floor that counts as loud
export const VOICE_ACTIVITY_MIN_TURN_MS = 280; // shorter utterances are dropped as clicks
export const VOICE_ACTIVITY_MAX_TURN_MS = 60_000; // hard stop for a runaway turn
// An open turn that never looks like a voice is ambient: close it rather than
// recording a minute of HVAC for Whisper to caption.
export const VOICE_ACTIVITY_AMBIENT_GIVE_UP_MS = 1200;
// Peak RMS of the talking portion must clear the floor-at-open by this much.
export const VOICE_ACTIVITY_SPEECH_RMS_MARGIN = 0.028;
export const VOICE_ACTIVITY_MIN_SPEECH_RMS = 0.024;
// PCM transients of a voice; room tone rarely spikes this high without AGC
// pumping, and even then the RMS margin still has to pass.
export const VOICE_ACTIVITY_MIN_SPEECH_PEAK = 0.038;
// A single energy spike is a chair or a door. Speech holds for a beat.
export const VOICE_ACTIVITY_MIN_SPEECH_HOLD_MS = 100;

/**
 * Whether the captured energy is a person talking, not a bump in room tone.
 *
 * `noiseFloor` and `rmsPeak` are both analyser RMS. `speechPeak` is PCM
 * |sample| — a different unit, used only as a transient check.
 *
 * @param {Object} reading
 * @param {number} reading.speechPeak Peak |sample| in the captured PCM.
 * @param {number} reading.rmsPeak Peak analyser RMS during the turn.
 * @param {number} reading.noiseFloor RMS floor from when the turn opened.
 * @returns {boolean}
 */
export function utteranceIsSpeech({ speechPeak, rmsPeak, noiseFloor }) {
  const peak = Number(speechPeak) || 0;
  const rms = Number(rmsPeak) || 0;
  const floor = Number(noiseFloor) || 0;
  if (peak < VOICE_ACTIVITY_MIN_SPEECH_PEAK) return false;
  if (rms < VOICE_ACTIVITY_MIN_SPEECH_RMS) return false;
  return rms >= floor + VOICE_ACTIVITY_SPEECH_RMS_MARGIN;
}

/**
 * Whether a turn should be sent to Whisper, not just look briefly loud.
 *
 * Ambient with AGC can pass a one-frame peak test. A real utterance holds
 * above the speech gate, and its spectrum sits in the voice band rather
 * than in rumble.
 *
 * @param {Object} reading
 * @param {number} reading.speechPeak
 * @param {number} reading.rmsPeak
 * @param {number} reading.noiseFloor
 * @param {number} [reading.speechHoldMs]
 * @param {boolean} [reading.voiceSpectrum]
 * @returns {boolean}
 */
export function utteranceIsSendable({
  speechPeak,
  rmsPeak,
  noiseFloor,
  speechHoldMs = 0,
  voiceSpectrum = false,
} = {}) {
  if (!utteranceIsSpeech({ speechPeak, rmsPeak, noiseFloor })) return false;
  if ((Number(speechHoldMs) || 0) < VOICE_ACTIVITY_MIN_SPEECH_HOLD_MS) {
    return false;
  }
  return Boolean(voiceSpectrum);
}

/**
 * Whether a frequency snapshot looks like a voice rather than rumble or hiss.
 *
 * `bins` are `AnalyserNode.getByteFrequencyData` values (0–255). Voice energy
 * lives between about 250 Hz and 3.5 kHz; HVAC and traffic sit well below.
 *
 * @param {ArrayLike<number>|null|undefined} bins
 * @param {{sampleRate?: number, fftSize?: number}} [options]
 * @returns {boolean}
 */
export function spectrumLooksLikeVoice(
  bins,
  { sampleRate = 48_000, fftSize = 1024 } = {}
) {
  const count = bins?.length ?? 0;
  if (!count || !sampleRate || !fftSize) return false;
  const binHz = sampleRate / fftSize;
  let voice = 0;
  let voiceN = 0;
  let other = 0;
  let otherN = 0;
  for (let index = 1; index < count; index += 1) {
    const hz = index * binHz;
    if (hz > 8000) break;
    const magnitude = bins[index];
    if (hz >= 250 && hz <= 3500) {
      voice += magnitude;
      voiceN += 1;
    } else {
      other += magnitude;
      otherN += 1;
    }
  }
  const voiceMean = voiceN ? voice / voiceN : 0;
  const otherMean = otherN ? other / otherN : 0;
  return voiceMean >= 18 && voiceMean >= otherMean * 0.9;
}

/**
 * Nudge the RMS floor toward a rejected clip's RMS so the same ambient band
 * cannot immediately open another turn. Never accept a PCM peak here: that
 * value is several times larger and would deafen the next real sentence.
 *
 * @param {number} noiseFloor
 * @param {number} rejectedRms Peak RMS of the rejected clip.
 * @returns {number}
 */
export function noiseFloorAfterRejectedUtterance(noiseFloor, rejectedRms) {
  const floor = Number(noiseFloor) || 0;
  const level = Number(rejectedRms) || 0;
  if (level <= floor) return floor;
  const nudged = floor + (level - floor) * 0.5;
  return Math.min(nudged, floor * 1.8 + 0.008);
}

/**
 * Track the noise floor. Quiet frames follow the room. Clear speech does not
 * pull the floor up, or a steady voice would end itself. Floor adaptation
 * during a turn that is not yet speech is handled by giving the turn up,
 * not by chasing RMS mid-utterance.
 *
 * @param {number} noiseFloor
 * @param {number} level
 * @param {{speaking?: boolean, clearlySpeech?: boolean}} [state]
 * @returns {number}
 */
export function nextNoiseFloor(
  noiseFloor,
  level,
  { speaking = false, clearlySpeech: _clearlySpeech = false } = {}
) {
  const floor = Number(noiseFloor) || 0;
  const sample = Number(level) || 0;
  if (speaking) return floor;
  return floor * 0.9 + sample * 0.1;
}

const peakOfChunks = (chunks) => {
  let peak = 0;
  for (const chunk of chunks) {
    const magnitude = pcmPeakAbs(chunk);
    if (magnitude > peak) peak = magnitude;
  }
  return peak;
};

/**
 * Start live listening.
 *
 * @param {Object} handlers
 * @param {Function} [handlers.onSpeechStart] The person began an utterance.
 * @param {Function} [handlers.onSpeechEnd] The turn closed, sent or dropped.
 * @param {Function} [handlers.onUtterance] Called with a File once an utterance ends.
 * @param {Function} [handlers.onLevel] Called each frame with the current RMS (for a meter).
 * @param {Function} [handlers.onError] Microphone or recorder failure.
 * `pause` mutes: the microphone track is disabled (the browser hears
 * nothing), any open turn is closed, and the level reads zero. `resume`
 * re-enables the track. The stream itself stays open so the switch is instant.
 *
 * @returns {Promise<{stop: Function, pause: Function, resume: Function, isPaused: () => boolean}>}
 */
export async function startVoiceActivityListening({
  onSpeechStart,
  onSpeechEnd,
  onUtterance,
  onLevel,
  onError,
} = {}) {
  const stream = await openMicrophoneStream();
  const AudioContextCtor = globalThis.AudioContext || globalThis.webkitAudioContext;
  const audioContext = new AudioContextCtor();
  await resumeAudioContext(audioContext);
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.2;
  source.connect(analyser);
  const samples = new Float32Array(analyser.fftSize);
  const spectrum = new Uint8Array(analyser.frequencyBinCount);
  const preRoll = new PcmPreRoll(audioContext.sampleRate);
  let utteranceChunks = [];
  let speechPeak = 0;
  let rmsPeak = 0;
  let speechHoldMs = 0;
  let voiceSpectrum = false;
  let lastFrameAt = 0;
  let floorAtOpen = 0;
  let paused = false;
  let stopped = false;
  let noiseFloor = 0;
  let calibrationSamples = [];
  let speaking = false;
  let announcedSpeech = false;
  let aboveSince = null;
  let belowSince = null;
  let turnStartedAt = null;
  let frame = null;
  const startedAt = performance.now();

  let tap;
  try {
    tap = attachPcmTap(audioContext, source, (pcm) => {
      if (stopped || paused) return;
      if (speaking) {
        utteranceChunks.push(new Float32Array(pcm));
        const peak = pcmPeakAbs(pcm);
        if (peak > speechPeak) speechPeak = peak;
      } else {
        preRoll.push(pcm);
      }
    });
  } catch (tapError) {
    for (const track of stream.getTracks()) track.stop();
    audioContext.close().catch(() => {});
    onError?.(tapError);
    throw tapError;
  }

  const rms = () => {
    analyser.getFloatTimeDomainData(samples);
    let sum = 0;
    for (let index = 0; index < samples.length; index += 1) {
      sum += samples[index] * samples[index];
    }
    return Math.sqrt(sum / samples.length);
  };

  const beginTurn = (level = 0) => {
    utteranceChunks = preRoll.snapshot();
    speechPeak = peakOfChunks(utteranceChunks);
    rmsPeak = Number(level) || 0;
    speechHoldMs = 0;
    voiceSpectrum = false;
    floorAtOpen = noiseFloor;
    announcedSpeech = false;
    turnStartedAt = performance.now();
    speaking = true;
  };

  const endTurn = () => {
    const chunks = utteranceChunks;
    const peak = speechPeak;
    const loudestRms = rmsPeak;
    const floor = floorAtOpen;
    const heldMs = speechHoldMs;
    const heardVoice = voiceSpectrum;
    const didAnnounce = announcedSpeech;
    speaking = false;
    announcedSpeech = false;
    utteranceChunks = [];
    speechPeak = 0;
    rmsPeak = 0;
    speechHoldMs = 0;
    voiceSpectrum = false;
    const duration = performance.now() - (turnStartedAt ?? performance.now());
    turnStartedAt = null;
    if (didAnnounce) onSpeechEnd?.();
    if (duration < VOICE_ACTIVITY_MIN_TURN_MS || chunks.length === 0) {
      return;
    }
    if (
      !utteranceIsSendable({
        speechPeak: peak,
        rmsPeak: loudestRms,
        noiseFloor: floor,
        speechHoldMs: heldMs,
        voiceSpectrum: heardVoice,
      })
    ) {
      noiseFloor = noiseFloorAfterRejectedUtterance(noiseFloor, loudestRms);
      return;
    }
    const file = wavFileFromPcmChunks(
      chunks,
      audioContext.sampleRate,
      'utterance.wav'
    );
    if (!file) return;
    onUtterance?.(file, { durationMs: duration });
  };

  const tick = () => {
    if (stopped) return;
    frame = requestAnimationFrame(tick);
    // A muted microphone reads as silence: the meter rests and nothing is
    // recorded, even though the stream stays open so unmuting is instant.
    const level = paused ? 0 : rms();
    onLevel?.(level);
    const now = performance.now();

    if (now - startedAt < VOICE_ACTIVITY_CALIBRATION_MS) {
      calibrationSamples.push(level);
      return;
    }
    if (calibrationSamples.length) {
      calibrationSamples.sort((a, b) => a - b);
      noiseFloor = calibrationSamples[Math.floor(calibrationSamples.length / 2)] ?? 0;
      calibrationSamples = [];
    }
    if (paused) {
      if (speaking) endTurn();
      aboveSince = null;
      belowSince = null;
      lastFrameAt = 0;
      return;
    }

    if (speaking && level > rmsPeak) rmsPeak = level;

    analyser.getByteFrequencyData(spectrum);
    const frameLooksLikeVoice = spectrumLooksLikeVoice(spectrum, {
      sampleRate: audioContext.sampleRate,
      fftSize: analyser.fftSize,
    });
    if (speaking && frameLooksLikeVoice) voiceSpectrum = true;

    const isLoud = level > noiseFloor + VOICE_ACTIVITY_MARGIN;
    if (isLoud) {
      belowSince = null;
      if (aboveSince == null) aboveSince = now;
      if (!speaking && now - aboveSince >= VOICE_ACTIVITY_START_MS) {
        beginTurn(level);
      }
    }
    const clearlySpeech =
      speaking &&
      utteranceIsSpeech({
        speechPeak,
        rmsPeak,
        noiseFloor: floorAtOpen,
      });
    const frameDelta = Math.min(lastFrameAt ? now - lastFrameAt : 16, 50);
    lastFrameAt = now;
    if (speaking && clearlySpeech) speechHoldMs += frameDelta;
    if (isLoud) {
      if (
        speaking &&
        clearlySpeech &&
        voiceSpectrum &&
        speechHoldMs >= VOICE_ACTIVITY_MIN_SPEECH_HOLD_MS &&
        !announcedSpeech
      ) {
        announcedSpeech = true;
        onSpeechStart?.();
      }
    } else {
      aboveSince = null;
      if (speaking) {
        if (belowSince == null) belowSince = now;
        if (now - belowSince >= VOICE_ACTIVITY_END_MS) endTurn();
      } else {
        noiseFloor = nextNoiseFloor(noiseFloor, level, { speaking: false });
      }
    }
    if (speaking && turnStartedAt) {
      const openFor = now - turnStartedAt;
      if (!clearlySpeech && openFor > VOICE_ACTIVITY_AMBIENT_GIVE_UP_MS) {
        endTurn();
      } else if (openFor > VOICE_ACTIVITY_MAX_TURN_MS) {
        endTurn();
      }
    }
  };

  frame = requestAnimationFrame(tick);

  return {
    stop: () => {
      stopped = true;
      if (frame) cancelAnimationFrame(frame);
      if (speaking) endTurn();
      tap.stop();
      for (const track of stream.getTracks()) track.stop();
      audioContext.close().catch(() => {});
    },
    pause: () => {
      paused = true;
      for (const track of stream.getAudioTracks()) track.enabled = false;
    },
    resume: () => {
      for (const track of stream.getAudioTracks()) track.enabled = true;
      paused = false;
    },
    isPaused: () => paused,
  };
}
