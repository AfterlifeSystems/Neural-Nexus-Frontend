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
// While the avatar is speaking, the caller keeps listening: speech above the
// threshold is reported as a barge-in so playback can stop and the new
// utterance becomes the next turn.

// Tunables. Milliseconds unless noted.
export const VOICE_ACTIVITY_CALIBRATION_MS = 500;
export const VOICE_ACTIVITY_START_MS = 120; // sustained speech before a turn opens
export const VOICE_ACTIVITY_END_MS = 700; // sustained silence before a turn closes
export const VOICE_ACTIVITY_MARGIN = 0.012; // RMS above the noise floor that counts as speech
export const VOICE_ACTIVITY_MIN_TURN_MS = 400; // shorter utterances are dropped as noise
export const VOICE_ACTIVITY_MAX_TURN_MS = 60_000; // hard stop for a runaway turn

function preferredRecordingMimeType() {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  return (
    candidates.find((candidate) =>
      window.MediaRecorder?.isTypeSupported?.(candidate)
    ) ?? ''
  );
}

/**
 * Start live listening.
 *
 * @param {Object} handlers
 * @param {Function} [handlers.onSpeechStart] The person began an utterance.
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
  onUtterance,
  onLevel,
  onError,
} = {}) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.2;
  source.connect(analyser);
  const samples = new Float32Array(analyser.fftSize);

  const mimeType = preferredRecordingMimeType();
  let recorder = null;
  let chunks = [];
  let paused = false;
  let stopped = false;
  let noiseFloor = 0;
  let calibrationSamples = [];
  let speaking = false;
  let aboveSince = null;
  let belowSince = null;
  let turnStartedAt = null;
  let frame = null;
  const startedAt = performance.now();

  const rms = () => {
    analyser.getFloatTimeDomainData(samples);
    let sum = 0;
    for (let index = 0; index < samples.length; index += 1) {
      sum += samples[index] * samples[index];
    }
    return Math.sqrt(sum / samples.length);
  };

  const beginTurn = () => {
    chunks = [];
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch (recorderError) {
      onError?.(recorderError);
      return;
    }
    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    });
    recorder.start(250);
    turnStartedAt = performance.now();
    speaking = true;
    onSpeechStart?.();
  };

  const endTurn = () => {
    const activeRecorder = recorder;
    recorder = null;
    speaking = false;
    const duration = performance.now() - (turnStartedAt ?? performance.now());
    turnStartedAt = null;
    if (!activeRecorder) return;
    activeRecorder.addEventListener(
      'stop',
      () => {
        if (duration < VOICE_ACTIVITY_MIN_TURN_MS || chunks.length === 0) return;
        const recordedType = activeRecorder.mimeType || mimeType || 'audio/webm';
        const extension = recordedType.includes('mp4') ? 'm4a' : 'webm';
        const file = new File([new Blob(chunks, { type: recordedType })], `utterance.${extension}`, {
          type: recordedType,
        });
        onUtterance?.(file, { durationMs: duration });
      },
      { once: true }
    );
    try {
      activeRecorder.stop();
    } catch {
      // Already stopped.
    }
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
      return;
    }

    const isLoud = level > noiseFloor + VOICE_ACTIVITY_MARGIN;
    if (isLoud) {
      belowSince = null;
      if (aboveSince == null) aboveSince = now;
      if (!speaking && now - aboveSince >= VOICE_ACTIVITY_START_MS) {
        beginTurn();
      }
      // Slowly adapt the floor downward only; upward drift would swallow speech.
    } else {
      aboveSince = null;
      if (speaking) {
        if (belowSince == null) belowSince = now;
        if (now - belowSince >= VOICE_ACTIVITY_END_MS) endTurn();
      } else {
        noiseFloor = noiseFloor * 0.98 + level * 0.02;
      }
    }
    if (speaking && turnStartedAt && now - turnStartedAt > VOICE_ACTIVITY_MAX_TURN_MS) {
      endTurn();
    }
  };

  frame = requestAnimationFrame(tick);

  return {
    stop: () => {
      stopped = true;
      if (frame) cancelAnimationFrame(frame);
      if (speaking) endTurn();
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
