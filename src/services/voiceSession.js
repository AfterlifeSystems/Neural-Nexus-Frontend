// src/services/voiceSession.js
//
// Speaking and listening, kept apart from the screen that uses them.
//
// This is the TURN-BASED transport: the microphone records a whole turn, the
// recording is sent as an attachment on the ordinary message endpoint (the API
// transcribes audio uploads), and the reply is spoken by the browser. There is
// no duplex audio here — the avatar cannot be interrupted mid-sentence, and it
// does not hear you while it speaks.
//
// A realtime backend is coming. When it lands, it replaces the two halves below
// — `recordOneTurn` and `speak` — with a live session, and the screen that uses
// them should not have to change: it asks for a turn to be recorded and for
// text to be spoken, and does not know how either happens.

/**
 * Whether this browser can capture a microphone at all.
 *
 * `getUserMedia` is absent on insecure origins, so a page served over plain
 * HTTP from anything but localhost cannot record no matter what the user
 * permits. Worth checking before offering the feature rather than failing at
 * the moment someone presses the button.
 *
 * @returns {boolean}
 */
export function canCaptureMicrophone() {
  return Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
}

/**
 * Pick a recording format this browser will actually produce.
 *
 * Browsers disagree: Chromium records WebM/Opus, Safari records MP4/AAC.
 * Asking for an unsupported type throws, and passing nothing yields a
 * browser-chosen default whose MIME type the file then has to carry so the
 * server can identify it.
 *
 * @returns {string} A supported MIME type, or '' to let the browser choose.
 */
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
 * Record from the microphone until the returned `stop` is called.
 *
 * The microphone track is stopped as soon as the recording ends, so the
 * browser's recording indicator goes out immediately rather than lingering for
 * as long as the page is open.
 *
 * @returns {Promise<{stop: function(): Promise<File>, cancel: function(): void}>}
 *   `stop` resolves with the recorded audio as a File ready to attach;
 *   `cancel` discards the recording and releases the microphone.
 */
export async function recordOneTurn() {
  const microphoneStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
  });
  const mimeType = preferredRecordingMimeType();
  const recorder = new MediaRecorder(
    microphoneStream,
    mimeType ? { mimeType } : undefined
  );
  const recordedChunks = [];
  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  });
  recorder.start();

  const releaseMicrophone = () => {
    for (const track of microphoneStream.getTracks()) {
      track.stop();
    }
  };

  return {
    stop: () =>
      new Promise((resolve) => {
        recorder.addEventListener(
          'stop',
          () => {
            releaseMicrophone();
            const recordedType = recorder.mimeType || mimeType || 'audio/webm';
            const fileExtension = recordedType.includes('mp4') ? 'm4a' : 'webm';
            const recording = new Blob(recordedChunks, { type: recordedType });
            resolve(
              new File([recording], `voice-turn.${fileExtension}`, {
                type: recordedType,
              })
            );
          },
          { once: true }
        );
        recorder.stop();
      }),
    cancel: () => {
      try {
        recorder.stop();
      } catch {
        // Already stopped; releasing the microphone is what matters.
      }
      releaseMicrophone();
    },
  };
}

/**
 * Say something out loud.
 *
 * Uses the browser's own speech synthesis, which costs nothing and needs no
 * backend. Any speech already in progress is cancelled first: two replies
 * talking over each other is worse than losing the older one.
 *
 * @param {string} text What to say.
 * @param {Object} [options]
 * @param {function(): void} [options.onStart] Called when speech begins.
 * @param {function(): void} [options.onEnd] Called when it finishes or fails.
 * @returns {boolean} Whether speech was started.
 */
export function speak(text, { onStart, onEnd } = {}) {
  if (!window.speechSynthesis || !text?.trim()) {
    onEnd?.();
    return false;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.addEventListener('start', () => onStart?.());
  utterance.addEventListener('end', () => onEnd?.());
  utterance.addEventListener('error', () => onEnd?.());
  window.speechSynthesis.speak(utterance);
  return true;
}

/**
 * Stop talking immediately.
 */
export function stopSpeaking() {
  window.speechSynthesis?.cancel();
}
