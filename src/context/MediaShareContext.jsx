import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { toast } from 'react-hot-toast';
import {
  canCaptureDisplay,
  requestDisplayMedia,
} from '../services/displayCapture';
import { useAuth } from './AuthContext';
import { useMedia } from './MediaContext';
import { AMBIENT_CAPTURE_INTERVAL_MS } from '../config/ambientCapture';
import {
  INITIAL_AMBIENT_STATUS,
  nextCaptureInMs,
  reduceAmbientEvent,
  retryAfterMillisecondsFromError,
  shouldCaptureNow,
  shouldDisableAfterFailures,
} from '../services/ambientCaptureScheduler';

const MediaShareContext = createContext(null);

const INACTIVE_SHARE = {
  webcamStream: null,
  screenStream: null,
  toggleWebcam: async () => {},
  toggleScreenShare: async () => {},
  captureShareStills: async () => [],
  ambientAllowed: false,
  ambientEnabled: false,
  setAmbientEnabled: () => {},
  ambientStatus: INITIAL_AMBIENT_STATUS,
  ambientNextInMs: 0,
  ambientIntervalMs: AMBIENT_CAPTURE_INTERVAL_MS,
  setAmbientVoiceMode: () => {},
  registerAmbientReplyHandler: () => () => {},
};

/** How often the timer wakes to ask whether a capture is due. */
const AMBIENT_TICK_MS = 1000;

/**
 * Grab one JPEG from a live video stream so it can go out as an attachment.
 *
 * @param {MediaStream} stream The webcam or screen.
 * @param {string} filename What to call the file.
 * @returns {Promise<File|null>}
 */
export async function snapshotStream(stream, filename) {
  if (!stream) return null;
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  try {
    await video.play();
    if (video.readyState < 2) {
      await new Promise((resolve, reject) => {
        video.onloadeddata = resolve;
        video.onerror = () => reject(new Error('Could not read that share.'));
      });
    }
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 360;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(video, 0, 0, width, height);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85)
    );
    if (!blob) return null;
    return new File([blob], filename, { type: 'image/jpeg' });
  } catch {
    return null;
  } finally {
    video.srcObject = null;
  }
}

/**
 * The live webcam and screen shares, and — when allowed — ambient vision:
 * one snapshot per live share sent to the avatar on a timer.
 *
 * @param {Object} props
 * @param {boolean} [props.ambientAllowed] Whether this screen may run ambient
 *   vision. Signed-in screens allow it; the anonymous shared-avatar page never
 *   does, because an observation is billed to the account that sends it.
 */
export function MediaShareProvider({ children, ambientAllowed = false }) {
  const [webcamStream, setWebcamStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const webcamStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const { activeAvatar } = useAuth();
  const {
    sendAmbientObservation,
    pendingSendCount,
    assistantActivity,
    pendingInterrupt,
    ambientHold,
  } = useMedia();

  // Ambient vision is per session and starts off: nothing is sent until the
  // person turns the eye on, and a reload never silently resumes capture.
  const [ambientEnabled, setAmbientEnabledState] = useState(false);
  const [ambientStatus, setAmbientStatus] = useState(INITIAL_AMBIENT_STATUS);
  const [ambientNextInMs, setAmbientNextInMs] = useState(0);
  const ambientVoiceModeRef = useRef(false);
  const ambientReplyHandlerRef = useRef(null);
  const ambientStatusRef = useRef(INITIAL_AMBIENT_STATUS);
  ambientStatusRef.current = ambientStatus;
  // The timer reads the newest values through one ref so a tick never acts on
  // a stale closure.
  const ambientConditionsRef = useRef({});
  ambientConditionsRef.current = {
    enabled: ambientAllowed && ambientEnabled,
    pendingSendCount,
    assistantActivity,
    pendingInterrupt,
    ambientHold,
    sendAmbientObservation,
    avatarName: activeAvatar?.name,
    hasAvatar: Boolean(activeAvatar),
  };

  useEffect(
    () => () => {
      webcamStreamRef.current?.getTracks().forEach((track) => track.stop());
      screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    },
    []
  );

  const toggleWebcam = useCallback(async () => {
    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach((track) => track.stop());
      webcamStreamRef.current = null;
      setWebcamStream(null);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('This browser cannot use the webcam here.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      webcamStreamRef.current = stream;
      setWebcamStream(stream);
    } catch (webcamError) {
      toast.error(
        webcamError?.name === 'NotAllowedError'
          ? 'Webcam access was refused. Allow it in your browser to share it.'
          : 'Could not enable the webcam.'
      );
    }
  }, []);

  const toggleScreenShare = useCallback(async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
      setScreenStream(null);
      return;
    }
    if (!canCaptureDisplay()) {
      toast.error(
        'This browser cannot share the screen. On a phone, try Safari (iOS) or Chrome (Android).'
      );
      return;
    }
    try {
      const stream = await requestDisplayMedia();
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        screenStreamRef.current = null;
        setScreenStream(null);
      });
      screenStreamRef.current = stream;
      setScreenStream(stream);
    } catch (screenError) {
      if (
        screenError?.name === 'NotAllowedError' ||
        screenError?.name === 'AbortError'
      ) {
        return;
      }
      toast.error('Could not share the screen.');
    }
  }, []);

  const captureShareStills = useCallback(async () => {
    const stills = await Promise.all([
      snapshotStream(webcamStreamRef.current, 'webcam.jpg'),
      snapshotStream(screenStreamRef.current, 'screen.jpg'),
    ]);
    return stills.filter(Boolean);
  }, []);

  const setAmbientEnabled = useCallback((enabled) => {
    setAmbientEnabledState((current) => {
      const next = typeof enabled === 'function' ? enabled(current) : Boolean(enabled);
      if (next !== current) {
        setAmbientStatus({ ...INITIAL_AMBIENT_STATUS });
      }
      return next;
    });
  }, []);

  const setAmbientVoiceMode = useCallback((inVoiceMode) => {
    ambientVoiceModeRef.current = Boolean(inVoiceMode);
  }, []);

  /**
   * Let voice mode speak the replies ambient vision produces. Returns the
   * function that unregisters the handler.
   */
  const registerAmbientReplyHandler = useCallback((handler) => {
    ambientReplyHandlerRef.current = handler;
    return () => {
      if (ambientReplyHandlerRef.current === handler) {
        ambientReplyHandlerRef.current = null;
      }
    };
  }, []);

  // Turning both shares off turns ambient vision off: there is nothing to see.
  useEffect(() => {
    if (!webcamStream && !screenStream && ambientEnabled) {
      setAmbientEnabledState(false);
      setAmbientStatus({ ...INITIAL_AMBIENT_STATUS });
    }
  }, [webcamStream, screenStream, ambientEnabled]);

  // One timer for the whole application. Every second it asks the scheduler
  // whether a capture is due; when one is, both live shares are snapshotted and
  // sent as one observation. A rate limit paces the next tick, and repeated
  // failures switch ambient vision off rather than retrying forever.
  useEffect(() => {
    if (!ambientAllowed || !ambientEnabled) {
      setAmbientNextInMs(0);
      return undefined;
    }
    let cancelled = false;
    const tick = async () => {
      const conditions = ambientConditionsRef.current;
      const status = ambientStatusRef.current;
      const now = Date.now();
      setAmbientNextInMs(
        nextCaptureInMs({
          lastCaptureAt: status.lastCapturedAt,
          intervalMs: AMBIENT_CAPTURE_INTERVAL_MS,
          retryAfterUntil: status.retryAfterUntil,
          now,
        })
      );
      if (
        !conditions.hasAvatar ||
        !shouldCaptureNow({
          enabled: conditions.enabled,
          hasWebcam: Boolean(webcamStreamRef.current),
          hasScreen: Boolean(screenStreamRef.current),
          inFlight: status.inFlight,
          pendingSendCount: conditions.pendingSendCount,
          assistantActivity: conditions.assistantActivity,
          pendingInterrupt: conditions.pendingInterrupt,
          ambientHold: conditions.ambientHold,
          lastCaptureAt: status.lastCapturedAt,
          intervalMs: AMBIENT_CAPTURE_INTERVAL_MS,
          retryAfterUntil: status.retryAfterUntil,
          now,
        })
      ) {
        return;
      }
      const apply = (event) => {
        const next = reduceAmbientEvent(ambientStatusRef.current, event);
        ambientStatusRef.current = next;
        if (!cancelled) setAmbientStatus(next);
        return next;
      };
      apply({ type: 'capture_started', at: now });
      try {
        const stills = await captureShareStills();
        if (!stills.length) {
          apply({ type: 'done' });
          return;
        }
        const outcome = await conditions.sendAmbientObservation(stills, {
          voiceMode: ambientVoiceModeRef.current,
        });
        if (outcome?.decision) {
          apply({
            type: 'ambient_decision',
            decision: outcome.decision,
            summary: outcome.summary,
            observation_id: outcome.observationId,
          });
        }
        apply({ type: 'done' });
        if (
          outcome?.reply &&
          (outcome.decision === 'respond' || outcome.decision === 'notify')
        ) {
          await ambientReplyHandlerRef.current?.(
            outcome.reply,
            outcome.sentiment,
            outcome.decision
          );
        }
      } catch (observationError) {
        const retryAfterMs = retryAfterMillisecondsFromError(observationError);
        const next = apply({
          type: 'failed',
          error: observationError?.message ?? 'The observation could not be sent.',
          retryAfterMs,
          at: Date.now(),
        });
        if (retryAfterMs == null) {
          console.error('Ambient observation failed:', observationError);
        }
        if (shouldDisableAfterFailures(next)) {
          setAmbientEnabledState(false);
          toast.error(
            'Ambient vision was turned off after repeated failures. Turn the eye back on to try again.'
          );
        }
      }
    };
    const timer = setInterval(tick, AMBIENT_TICK_MS);
    tick();
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [ambientAllowed, ambientEnabled, captureShareStills]);

  return (
    <MediaShareContext.Provider
      value={{
        webcamStream,
        screenStream,
        toggleWebcam,
        toggleScreenShare,
        captureShareStills,
        ambientAllowed,
        ambientEnabled,
        setAmbientEnabled,
        ambientStatus,
        ambientNextInMs,
        ambientIntervalMs: AMBIENT_CAPTURE_INTERVAL_MS,
        setAmbientVoiceMode,
        registerAmbientReplyHandler,
      }}
    >
      {children}
    </MediaShareContext.Provider>
  );
}

export function useMediaShare() {
  return useContext(MediaShareContext) ?? INACTIVE_SHARE;
}
