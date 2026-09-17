// src/services/avatarSpeechSession.js
//
// Message view and live voice mode each mount their own `useSpeech` hook, but
// every cloned-voice utterance plays through the one unlocked HTML audio
// element. Speaking state has to live here — beside that element — so a speak
// press in the transcript still lights the portrait glow (and shuts the
// microphone) after the person switches into voice mode. Per-hook React state
// alone cannot see an utterance another hook started.

import {
  clearActiveUtteranceSource,
  isUnlockedSpeechElement,
} from './avatarSpeechUnlock.js';

let nextSessionOwnerId = 1;
let activeSessionOwnerId = null;
let sessionIsSpeaking = false;
let sessionSpeakingKey = null;
let sessionAbortController = null;
let sessionDetachListeners = null;
let sessionSettleUtterance = null;
let sessionAudioElement = null;
let sessionObjectUrl = null;

const sessionSubscribers = new Set();

function notifySessionSubscribers() {
  for (const subscriber of sessionSubscribers) {
    subscriber();
  }
}

/**
 * Snapshot of the one utterance currently owned by the shared audio element.
 *
 * @returns {{ isSpeaking: boolean, speakingKey: string|null }}
 */
export function readAvatarSpeechSession() {
  return {
    isSpeaking: sessionIsSpeaking,
    speakingKey: sessionSpeakingKey,
  };
}

/**
 * Subscribe to speaking-state changes across every `useSpeech` hook.
 *
 * @param {() => void} subscriber
 * @returns {() => void} Unsubscribe.
 */
export function subscribeAvatarSpeechSession(subscriber) {
  sessionSubscribers.add(subscriber);
  return () => {
    sessionSubscribers.delete(subscriber);
  };
}

/**
 * Mint a stable owner id for one `useSpeech` hook instance.
 *
 * @returns {number}
 */
export function claimAvatarSpeechSessionOwnerId() {
  const ownerId = nextSessionOwnerId;
  nextSessionOwnerId += 1;
  return ownerId;
}

/**
 * Whether this hook instance currently owns the in-flight utterance.
 *
 * @param {number} ownerId
 * @returns {boolean}
 */
export function avatarSpeechSessionOwnedBy(ownerId) {
  return activeSessionOwnerId === ownerId;
}

/**
 * Publish speaking flags so every hook re-renders together.
 *
 * @param {{ isSpeaking: boolean, speakingKey: string|null }} nextState
 * @returns {void}
 */
export function publishAvatarSpeechSession(nextState) {
  sessionIsSpeaking = Boolean(nextState.isSpeaking);
  sessionSpeakingKey = nextState.speakingKey ?? null;
  notifySessionSubscribers();
}

/**
 * Remember the media handles for the utterance this owner just started.
 *
 * @param {Object} handles
 * @param {number} handles.ownerId
 * @param {AbortController|null} handles.abortController
 * @param {(() => void)|null} handles.detachListeners
 * @param {((autoplayBlocked?: boolean) => void)|null} handles.settleUtterance
 * @param {HTMLAudioElement|null} handles.audioElement
 * @param {string|null} handles.objectUrl
 * @returns {void}
 */
export function bindAvatarSpeechSession({
  ownerId,
  abortController = null,
  detachListeners = null,
  settleUtterance = null,
  audioElement = null,
  objectUrl = null,
}) {
  activeSessionOwnerId = ownerId;
  sessionAbortController = abortController;
  sessionDetachListeners = detachListeners;
  sessionSettleUtterance = settleUtterance;
  sessionAudioElement = audioElement;
  sessionObjectUrl = objectUrl;
}

/**
 * Release the audio element and object URL for the shared utterance.
 *
 * @returns {void}
 */
export function releaseAvatarSpeechSessionMedia() {
  if (sessionDetachListeners) {
    sessionDetachListeners();
    sessionDetachListeners = null;
  }
  if (sessionAudioElement) {
    sessionAudioElement.pause();
    if (!isUnlockedSpeechElement(sessionAudioElement)) {
      sessionAudioElement.src = '';
    }
    sessionAudioElement = null;
  }
  if (sessionObjectUrl) {
    clearActiveUtteranceSource(sessionObjectUrl);
    URL.revokeObjectURL(sessionObjectUrl);
    sessionObjectUrl = null;
  }
}

/**
 * Stop the shared utterance. Any hook may call this — starting a new line in
 * voice mode has to cut a transcript speak that is still playing.
 *
 * @returns {void}
 */
export function stopAvatarSpeechSession() {
  sessionAbortController?.abort();
  sessionAbortController = null;
  const settleInFlightUtterance = sessionSettleUtterance;
  if (settleInFlightUtterance) {
    settleInFlightUtterance();
  } else {
    releaseAvatarSpeechSessionMedia();
    activeSessionOwnerId = null;
    publishAvatarSpeechSession({ isSpeaking: false, speakingKey: null });
  }
}

/**
 * Unmount cleanup: only the owner may stop playback, otherwise leaving the
 * chat tab while voice mode is speaking would silence the stage.
 *
 * @param {number} ownerId
 * @returns {void}
 */
export function releaseAvatarSpeechSessionOwner(ownerId) {
  if (activeSessionOwnerId !== ownerId) return;
  stopAvatarSpeechSession();
}

/**
 * Test helper: clear module state between cases.
 *
 * @returns {void}
 */
export function resetAvatarSpeechSessionForTests() {
  sessionAbortController = null;
  sessionDetachListeners = null;
  sessionSettleUtterance = null;
  if (sessionAudioElement) {
    try {
      sessionAudioElement.pause();
      sessionAudioElement.src = '';
    } catch {
      // An element the test already tore down is fine.
    }
  }
  sessionAudioElement = null;
  if (sessionObjectUrl) {
    try {
      URL.revokeObjectURL(sessionObjectUrl);
    } catch {
      // Revoking twice in a test harness is fine.
    }
  }
  sessionObjectUrl = null;
  activeSessionOwnerId = null;
  sessionIsSpeaking = false;
  sessionSpeakingKey = null;
  sessionSubscribers.clear();
  nextSessionOwnerId = 1;
}
