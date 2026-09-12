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
import {
  publishLiveShares,
  resetLiveShares,
} from '../services/liveShareRegistry';
import {
  AMBIENT_CAPTURE_INTERVAL_MS,
  AMBIENT_FRAME_CHANGE_THRESHOLD,
  AMBIENT_QUIET_HEARTBEAT_MS,
} from '../config/ambientCapture';
import {
  CAMERA_FACING_FRONT,
  CAMERA_FACING_REAR,
  facingFromTrackSettings,
  isMobileCameraView,
  openCameraStream,
  oppositeCameraFacing,
} from '../services/cameraFacing';
import {
  SCENE_NARRATION_HEARTBEAT_MS,
  SCENE_NARRATION_INTERVAL_MS,
} from '../config/sceneNarrationCapture';
import useSceneNarration from '../hooks/useSceneNarration';
import { useVoiceMute } from './VoiceMuteContext';
import {
  speakLocally,
  speakNarration,
  stopNarrationSpeech,
} from '../services/sceneNarrationSpeech';
import useMotionWireframe from '../hooks/useMotionWireframe';
import useMotionCapture from '../hooks/useMotionCapture';
import { MOTION_WIREFRAME_ENABLED } from '../config/motionWireframe';
import { shouldRunMotionCapture } from '../config/motionCapture';
import { getAvatarMotionBasis, postAvatarMotionTrack } from '../services/avatarService';
import { resolveAssistantId } from '../components/utils';
import {
  INITIAL_AMBIENT_STATUS,
  isAmbientVisionActive,
  isObservationYield,
  nextCaptureInMs,
  reduceAmbientEvent,
  retryAfterMillisecondsFromError,
  shouldCaptureNow,
  AMBIENT_FRAME_SIGNATURE_EDGE,
  frameSignatureFromPixels,
  shouldSendCapturedFrame,
  shouldReportRepeatedFailures,
} from '../services/ambientCaptureScheduler';

const MediaShareContext = createContext(null);

const INACTIVE_SHARE = {
  webcamStream: null,
  screenStream: null,
  webcamFacingMode: 'user',
  isFlippingWebcam: false,
  toggleWebcam: async () => {},
  flipWebcam: async () => {},
  toggleScreenShare: async () => {},
  toggleScreenPeek: async () => {},
  screenWatched: false,
  captureShareStills: async () => [],
  ambientAllowed: false,
  ambientCaptureAllowed: false,
  ambientEnabled: false,
  ambientStatus: INITIAL_AMBIENT_STATUS,
  ambientNextInMs: 0,
  ambientIntervalMs: AMBIENT_CAPTURE_INTERVAL_MS,
  setAmbientVoiceMode: () => {},
  registerAmbientReplyHandler: () => () => {},
  sceneNarrationOn: false,
  sceneNarrationActive: false,
  setSceneNarration: () => {},
  sceneNarrationSpeaking: false,
};

/** How often the timer wakes to ask whether a capture is due. */
const AMBIENT_TICK_MS = 1000;

/**
 * The longest a single scene description may be considered "being spoken".
 *
 * Generous: a long description read slowly, over a slow fetch of the avatar's
 * voice, still finishes well inside this. It exists only so that a flag which
 * somehow outlives its utterance cannot keep the microphone shut.
 */
const NARRATION_SPEECH_CEILING_MS = 30_000;

/**
 * Grab one JPEG from a live video stream, with a signature of what it shows.
 *
 * The signature lets the caller tell whether the scene actually changed since
 * the last frame it sent, so an unchanging room costs no vision calls.
 *
 * @param {MediaStream} stream The webcam or screen.
 * @param {string} filename What to call the file.
 * @returns {Promise<{file: File, signature: Uint8Array|null}|null>}
 */
export async function snapshotStreamWithSignature(stream, filename) {
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
    return {
      file: new File([blob], filename, { type: 'image/jpeg' }),
      signature: signatureFromCanvas(canvas),
    };
  } catch {
    return null;
  } finally {
    video.srcObject = null;
  }
}

/**
 * Reduce an already-drawn frame to the small grayscale signature used to tell
 * whether the scene changed. Drawing the same canvas down to a thumbnail costs
 * nothing next to the capture that already happened.
 *
 * @param {HTMLCanvasElement} canvas The full-size frame.
 * @returns {Uint8Array|null} One brightness byte per thumbnail pixel.
 */
function signatureFromCanvas(canvas) {
  try {
    const edge = AMBIENT_FRAME_SIGNATURE_EDGE;
    const thumbnail = document.createElement('canvas');
    thumbnail.width = edge;
    thumbnail.height = edge;
    const context = thumbnail.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(canvas, 0, 0, edge, edge);
    return frameSignatureFromPixels(context.getImageData(0, 0, edge, edge).data);
  } catch {
    // A tainted or unreadable canvas means no signature, which reads as
    // "changed" downstream: the frame is sent rather than silently dropped.
    return null;
  }
}

/**
 * Grab one JPEG from a live video stream so it can go out as an attachment.
 *
 * @param {MediaStream} stream The webcam or screen.
 * @param {string} filename What to call the file.
 * @returns {Promise<File|null>}
 */
/** Read a captured still as a data URI, for a request that carries JSON. */
function fileToDataUri(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function snapshotStream(stream, filename) {
  const captured = await snapshotStreamWithSignature(stream, filename);
  return captured?.file ?? null;
}

/**
 * The live webcam and screen shares, and — when allowed — ambient vision:
 * one snapshot per live share sent to the avatar on a timer. There is no
 * button: sharing a webcam or a screen starts the looks, and stopping the last
 * share ends them.
 *
 * The share is background context only. Snapshots go out as hidden
 * observations from this timer and never ride along with a typed or spoken
 * message, so nothing from the share is painted into the conversation and the
 * person's own turns go out at once. An observation in flight when the person
 * sends a message is stopped for it (see `yieldAmbientObservations`).
 *
 * @param {Object} props
 * @param {boolean} [props.ambientAllowed] Whether this account may run ambient
 *   vision at all. Signed-in screens allow it; the anonymous shared-avatar
 *   page never does, because an observation is billed to the account that
 *   sends it.
 * @param {boolean} [props.ambientCaptureAllowed] Whether this location may
 *   send a snapshot. Webcam and screen stay up on the gallery; observations
 *   only go out in the message view or voice mode.
 */
export function MediaShareProvider({
  children,
  ambientAllowed = false,
  ambientCaptureAllowed = false,
}) {
  const [webcamStream, setWebcamStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [webcamFacingMode, setWebcamFacingMode] = useState(CAMERA_FACING_FRONT);
  const [isFlippingWebcam, setIsFlippingWebcam] = useState(false);
  const webcamStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  // Whether the screen capture that is running is WATCHED.
  //
  // There is one screen capture and two things the person can be doing with
  // it, which is the whole difference between sharing and peeking. Watched is
  // the ordinary share: the ambient loop snapshots it on the interval and the
  // avatar sees it change. Unwatched is a peek: the capture runs, the person
  // can see in their browser exactly what it covers, and NOTHING is read from
  // it until the avatar asks a question that needs a look — then one frame.
  //
  // Modelling these as one capture with a mode rather than two separate
  // captures matters: switching between them must not throw away the grant and
  // make the person pick their screen again, and a person who is already
  // sharing must be able to say "just peek" without a second picker.
  const screenWatchedRef = useRef(false);
  const [screenWatched, setScreenWatched] = useState(false);
  // Scene narration: the accessibility mode. While it is on, the rear camera
  // is pointed at the world, the scene is described every few seconds, and
  // every description is read aloud. The switch itself lives in
  // `src/config/sceneNarration.js` — per browser, flipped by the sidebar, the
  // Accessibility page, or any avatar the person asks — and this is where the
  // camera, the pacing and the voice follow it.
  const { sceneNarrationOn, sceneNarrationSeconds, setSceneNarrationOn } =
    useSceneNarration();
  // Muting the avatar and asking it to read your surroundings to you are
  // contradictory instructions, and the mode is the newer one. Switching
  // narration on therefore unmutes; muting afterwards is respected, because a
  // mute that does not silence the avatar is not a mute.
  const { setAvatarMuted } = useVoiceMute();
  const sceneNarrationRef = useRef(false);
  sceneNarrationRef.current = sceneNarrationOn;
  // Whether narration opened the camera itself. A camera the person opened
  // before turning narration on is theirs, and switching narration off must
  // leave it exactly as they left it.
  const narrationOpenedCameraRef = useRef(false);
  const [sceneNarrationSpeaking, setSceneNarrationSpeaking] = useState(false);
  const narrationSpeakingRef = useRef(false);
  const webcamFacingRef = useRef(CAMERA_FACING_FRONT);
  const webcamSessionRef = useRef(0);
  const { activeAvatar } = useAuth();
  const {
    sendAmbientObservation,
    pendingSendCount,
    assistantActivity,
    pendingInterrupt,
    ambientHold,
  } = useMedia();

  // Ambient vision has no switch: sharing a webcam or a screen starts the
  // looks, and stopping the last share stops them. A reload never silently
  // resumes capture because a reload ends the shares.
  // A screen being PEEKED at is not a screen being watched: the capture runs,
  // but nothing reads it until the avatar asks. That is the whole distinction
  // between the two modes, and this is where it has to hold — an ambient loop
  // that read a peek capture would turn a glance into surveillance.
  const screenIsWatched = screenWatched && Boolean(screenStream);
  const hasLiveShare = Boolean(webcamStream) || screenIsWatched;
  // Whether the surroundings are being described RIGHT NOW, as opposed to the
  // setting being on. The camera is what decides: closing the webcam stops the
  // describing and clears the indicator on its tile, and opening it again
  // while the setting is on starts the describing back up, with no trip to the
  // Accessibility page in between. That is what "the setting changes what the
  // webcam does" means — one capture doing more, rather than a second camera.
  const sceneNarrationActive =
    sceneNarrationOn && Boolean(webcamStream) && Boolean(activeAvatar);
  const ambientEnabled = isAmbientVisionActive({
    allowed: ambientAllowed,
    hasWebcam: Boolean(webcamStream),
    hasScreen: screenIsWatched,
  });
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
    enabled: ambientAllowed && ambientCaptureAllowed && ambientEnabled,
    pendingSendCount,
    assistantActivity,
    pendingInterrupt,
    ambientHold,
    sendAmbientObservation,
    avatarName: activeAvatar?.name,
    hasAvatar: Boolean(activeAvatar),
    // Scene narration changes three things about a look: how often one is
    // taken, how long an unchanging scene may go undescribed, and what happens
    // to the answer. Read through the same ref as everything else so a tick
    // never acts on a stale closure.
    narrating: sceneNarrationActive,
    // The person's own pace, from the slider or from asking the avatar for
    // more or less often — not a build-time constant.
    narrationIntervalMs: Math.round((sceneNarrationSeconds || 0) * 1000),
    assistantId: resolveAssistantId(activeAvatar),
  };

  // The wireframe over the person (src/hooks/useMotionWireframe.js): runs on
  // the webcam while an observation could be sent AND the person has switched
  // "Learn how I move" on (src/config/motionCapture.js — off by default, per
  // browser, flipped from account settings or the personal avatar's
  // settings), and hands windows to the ambient loop below. Once the API has
  // fitted this avatar's expression basis the browser encodes face frames
  // locally and the dense mesh stops crossing the wire; the basis is re-read
  // now and then to pick up a refit.
  const { motionCaptureEnabled } = useMotionCapture();
  const motionAssistantId = activeAvatar ? resolveAssistantId(activeAvatar) : null;
  const motionCaptureRuns = shouldRunMotionCapture({
    captureEnabled: motionCaptureEnabled,
    ambientAllowed,
    ambientCaptureAllowed,
    hasAvatar: Boolean(activeAvatar),
    // Only a camera facing the person can teach how the person moves; a
    // rear camera pointed at the world (the accessibility narration mode
    // paces those as fast as every five seconds) is not landmarked at all,
    // so a phone's battery is not spent on frames the API would refuse.
    cameraFacesPerson: webcamFacingMode === CAMERA_FACING_FRONT,
  });
  const [motionBasis, setMotionBasis] = useState(null);
  const motionBasisAvatarRef = useRef(null);
  useEffect(() => {
    if (
      !MOTION_WIREFRAME_ENABLED ||
      !motionCaptureRuns ||
      !motionAssistantId ||
      !webcamStream
    ) {
      return undefined;
    }
    let cancelled = false;
    const refresh = async () => {
      try {
        const basis = await getAvatarMotionBasis(motionAssistantId);
        if (cancelled) return;
        motionBasisAvatarRef.current = motionAssistantId;
        setMotionBasis((current) =>
          current?.basis_id === basis?.basis_id ? current : basis
        );
      } catch {
        // A basis is a saving, not a requirement; keep sending dense windows.
      }
    };
    refresh();
    const timer = setInterval(refresh, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [motionAssistantId, motionCaptureRuns, webcamStream]);
  const {
    frame: motionFrame,
    meshEdges: motionMeshEdges,
    frameSize: motionFrameSize,
    status: motionStatus,
    takeWindow: takeMotionWindow,
  } = useMotionWireframe(webcamStream, {
    enabled: motionCaptureRuns,
    basis: motionBasisAvatarRef.current === motionAssistantId ? motionBasis : null,
  });
  const takeMotionWindowRef = useRef(takeMotionWindow);
  takeMotionWindowRef.current = takeMotionWindow;
  const motionAssistantIdRef = useRef(motionAssistantId);
  motionAssistantIdRef.current = motionAssistantId;

  useEffect(
    () => () => {
      webcamStreamRef.current?.getTracks().forEach((track) => track.stop());
      screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    },
    []
  );

  const rememberWebcamFacing = (stream) => {
    const facing = facingFromTrackSettings(
      stream.getVideoTracks()[0]?.getSettings()
    );
    webcamFacingRef.current = facing;
    setWebcamFacingMode(facing);
  };

  const stopWebcamRef = useRef(null);

  const stopWebcam = () => {
    webcamSessionRef.current += 1;
    webcamStreamRef.current?.getTracks().forEach((track) => track.stop());
    webcamStreamRef.current = null;
    webcamFacingRef.current = CAMERA_FACING_FRONT;
    setWebcamFacingMode(CAMERA_FACING_FRONT);
    setWebcamStream(null);
  };
  // Depending on `stopWebcam` itself would re-run the narration effect on
  // every render — and re-running it while narration is on reopens the camera.
  stopWebcamRef.current = stopWebcam;

  const toggleWebcam = useCallback(async () => {
    if (webcamStreamRef.current) {
      stopWebcam();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('This browser cannot use the webcam here.');
      return;
    }
    const session = ++webcamSessionRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      if (session !== webcamSessionRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      webcamStreamRef.current = stream;
      rememberWebcamFacing(stream);
      setWebcamStream(stream);
    } catch (webcamError) {
      if (session !== webcamSessionRef.current) return;
      toast.error(
        webcamError?.name === 'NotAllowedError'
          ? 'Webcam access was refused. Allow it in your browser to share it.'
          : 'Could not enable the webcam.'
      );
    }
  }, []);

  const flipWebcam = useCallback(async () => {
    if (!webcamStreamRef.current || isFlippingWebcam) return;
    const session = webcamSessionRef.current;
    const nextFacing = oppositeCameraFacing(webcamFacingRef.current);
    const previousFacing = webcamFacingRef.current;
    setIsFlippingWebcam(true);
    webcamStreamRef.current.getTracks().forEach((track) => track.stop());
    webcamStreamRef.current = null;
    try {
      const stream = await openCameraStream(nextFacing);
      if (session !== webcamSessionRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      webcamStreamRef.current = stream;
      rememberWebcamFacing(stream);
      setWebcamStream(stream);
    } catch {
      if (session !== webcamSessionRef.current) return;
      try {
        const restored = await openCameraStream(previousFacing);
        if (session !== webcamSessionRef.current) {
          restored.getTracks().forEach((track) => track.stop());
          return;
        }
        webcamStreamRef.current = restored;
        rememberWebcamFacing(restored);
        setWebcamStream(restored);
      } catch {
        if (session === webcamSessionRef.current) stopWebcam();
      }
      toast.error('Could not switch cameras.');
    } finally {
      if (session === webcamSessionRef.current) {
        setIsFlippingWebcam(false);
      }
    }
  }, [isFlippingWebcam]);

  /**
   * Point the camera at the world, for scene narration.
   *
   * The REAR camera, because the whole mode is about what is in front of the
   * person rather than what their face is doing: a phone held up or worn on a
   * lanyard is their own view, and describing their chin instead would be
   * useless to them. A device with one camera opens that one — the constraint
   * is `ideal`, so a laptop narrates its webcam rather than failing — and a
   * camera the person already had open is flipped to face outward only where a
   * second camera plausibly exists.
   *
   * Nothing here is a share the avatar started on its own: the person (or an
   * avatar they asked, in words, to start describing) turned this mode on, and
   * the camera light is on for exactly as long as the mode is.
   *
   * @returns {Promise<boolean>} Whether a camera is now open.
   */
  const startNarrationCamera = useCallback(async () => {
    if (webcamStreamRef.current) {
      if (
        webcamFacingRef.current !== CAMERA_FACING_REAR &&
        isMobileCameraView()
      ) {
        await flipWebcam();
      }
      return true;
    }
    if (!navigator.mediaDevices?.getUserMedia) return false;
    const session = ++webcamSessionRef.current;
    try {
      const stream = await openCameraStream(CAMERA_FACING_REAR);
      if (session !== webcamSessionRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }
      webcamStreamRef.current = stream;
      rememberWebcamFacing(stream);
      setWebcamStream(stream);
      // Remembered so that switching narration off closes the camera narration
      // opened, and leaves alone a camera the person was already sharing.
      narrationOpenedCameraRef.current = true;
      return true;
    } catch (cameraError) {
      if (session !== webcamSessionRef.current) return false;
      console.warn('The camera could not be opened for narration:', cameraError);
      return false;
    }
  }, [flipWebcam]);

  // Follow the SETTING: switching it on opens the camera and the loop below
  // begins describing; switching it off closes what narration opened and
  // silences what is being said mid-sentence, because "stop" from someone who
  // cannot see the screen means stop now.
  //
  // This effect deliberately does not depend on `webcamStream`. The setting is
  // a standing preference about what the webcam DOES, not a capture of its
  // own: a person who closes the camera has closed it, and an effect that
  // re-ran on that would reopen the very camera they just turned off. Whether
  // narration is running right now is `sceneNarrationActive` below, which is
  // the setting AND a live camera.
  useEffect(() => {
    // No avatar open means nobody to do the describing, and a camera light on
    // with nothing being said is the worst of both: the person cannot see that
    // it is on, and it tells them nothing. The Accessibility page says in words
    // that an avatar has to be open; this effect runs again when one is.
    if (!sceneNarrationOn || !activeAvatar) {
      stopNarrationSpeech();
      narrationSpeakingRef.current = false;
      setSceneNarrationSpeaking(false);
      if (narrationOpenedCameraRef.current) {
        narrationOpenedCameraRef.current = false;
        stopWebcamRef.current?.();
      }
      return undefined;
    }
    // Unmuted on the way in, every time, not only on the first switch-on: a
    // person who muted the avatar and then asked for their surroundings would
    // otherwise get a camera light, a bill, and silence.
    setAvatarMuted(false);
    let cancelled = false;
    (async () => {
      const opened = await startNarrationCamera();
      if (cancelled || opened) return;
      // Said aloud as well as shown: the person this mode is for cannot read
      // a toast, and "nothing is happening" is the worst possible answer to a
      // camera permission they were never asked for.
      speakLocally(
        'The camera could not be opened, so there is nothing to describe. Please allow camera access, then switch describing on again.'
      );
      toast.error(
        'The camera could not be opened, so there is nothing to describe. Allow camera access and switch it on again.',
        { id: 'scene-narration-camera' }
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [sceneNarrationOn, activeAvatar, setAvatarMuted, startNarrationCamera]);

  // A camera that is gone cannot be described. Stop mid-sentence rather than
  // finishing a description of a scene nobody is pointing at any more, and let
  // go of the claim that narration owns this camera — the next switch-on opens
  // its own.
  useEffect(() => {
    if (webcamStream) return;
    narrationOpenedCameraRef.current = false;
    if (!narrationSpeakingRef.current) return;
    stopNarrationSpeech();
    narrationSpeakingRef.current = false;
    setSceneNarrationSpeaking(false);
  }, [webcamStream]);

  const stopScreenCapture = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;
    screenWatchedRef.current = false;
    setScreenWatched(false);
    setScreenStream(null);
  }, []);

  /**
   * Run the screen capture in the given mode, opening one if none is running.
   *
   * Must be called straight out of a press by the person when no capture is
   * running: no browser lets a page call `getDisplayMedia` any other way, and
   * none keeps a standing grant, so that press is the permission and what they
   * choose in the browser's own picker is exactly what can ever be seen.
   * Changing the mode of a capture that is ALREADY running asks the browser
   * for nothing — it only changes whether the ambient loop reads it — so
   * moving between peeking and sharing never costs a second picker.
   *
   * @param {boolean} watched Whether the ambient loop may read this capture.
   * @returns {Promise<boolean>} Whether a capture is now running in that mode.
   */
  const runScreenCapture = useCallback(async (watched) => {
    if (screenStreamRef.current) {
      screenWatchedRef.current = watched;
      setScreenWatched(watched);
      return true;
    }
    if (!canCaptureDisplay()) {
      toast.error(
        'This browser cannot share the screen. On a phone, try Safari (iOS) or Chrome (Android).'
      );
      return false;
    }
    try {
      const stream = await requestDisplayMedia();
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        // The person pressed the browser's own "Stop sharing".
        screenStreamRef.current = null;
        screenWatchedRef.current = false;
        setScreenWatched(false);
        setScreenStream(null);
      });
      screenStreamRef.current = stream;
      screenWatchedRef.current = watched;
      setScreenWatched(watched);
      setScreenStream(stream);
      return true;
    } catch (screenError) {
      if (
        screenError?.name === 'NotAllowedError' ||
        screenError?.name === 'AbortError'
      ) {
        return false;
      }
      toast.error('Could not share the screen.');
      return false;
    }
  }, []);

  /**
   * Let the avatar take single looks at the screen, without watching it.
   *
   * Off → the browser's picker, and the capture runs unwatched. Already
   * peeking → off. Already being shared → demoted to peeking, which needs no
   * picker because the capture the person granted is the same capture.
   *
   * @returns {Promise<void>}
   */
  const toggleScreenPeek = useCallback(async () => {
    if (screenStreamRef.current && !screenWatchedRef.current) {
      stopScreenCapture();
      return;
    }
    await runScreenCapture(false);
  }, [runScreenCapture, stopScreenCapture]);

  /**
   * Take one frame of the screen, from the capture that is already running.
   *
   * Used for a peek. A watched share is captured through the ordinary
   * `captureNamedShareStills` path instead; both read the same stream.
   *
   * @returns {Promise<File|null>} The frame, or null with nothing to look at.
   */
  const peekAtScreen = useCallback(async () => {
    if (!screenStreamRef.current) return null;
    try {
      return await snapshotStream(screenStreamRef.current, 'screen.jpg');
    } catch (peekError) {
      console.warn('The screen could not be captured for a look:', peekError);
      return null;
    }
  }, []);

  /**
   * Share the screen, watched: the ambient loop snapshots it on the interval.
   *
   * Off → the browser's picker. Already shared → off. Already being peeked at
   * → promoted to watched, which needs no picker.
   *
   * @returns {Promise<void>}
   */
  const toggleScreenShare = useCallback(async () => {
    if (screenStreamRef.current && screenWatchedRef.current) {
      stopScreenCapture();
      return;
    }
    await runScreenCapture(true);
  }, [runScreenCapture, stopScreenCapture]);

  // What each shared stream looked like the last time a frame of it was
  // actually sent, keyed by the stream's own id so that the webcam and the
  // screen — and a camera flipped mid-conversation — never share an entry.
  const lastSentFrameRef = useRef(new Map());

  /**
   * Capture one frame per live share, keeping only those worth sending.
   *
   * A frame that looks like the last one sent for that stream is dropped here,
   * before it costs a description call and a triage call. The person sharing a
   * webcam consented to being looked at; a still room is not news, and asking
   * the avatar to judge it again invites an answer to a question nobody asked.
   */
  const captureAmbientStills = useCallback(async (now, heartbeatMs) => {
    const sources = [
      [webcamStreamRef.current, 'webcam.jpg'],
      // Only a watched capture. A peek capture is read when the avatar asks
      // and at no other time.
      [screenWatchedRef.current ? screenStreamRef.current : null, 'screen.jpg'],
    ];
    const captured = await Promise.all(
      sources.map(([stream, filename]) =>
        snapshotStreamWithSignature(stream, filename)
      )
    );
    const remembered = lastSentFrameRef.current;
    const worthSending = [];
    for (let index = 0; index < sources.length; index += 1) {
      const [stream] = sources[index];
      const frame = captured[index];
      if (!frame || !stream) continue;
      const previous = remembered.get(stream.id);
      if (
        !shouldSendCapturedFrame({
          previousSignature: previous?.signature ?? null,
          nextSignature: frame.signature,
          threshold: AMBIENT_FRAME_CHANGE_THRESHOLD,
          lastSentAt: previous?.sentAt ?? null,
          // Narration describes an unchanging scene again far sooner than
          // ordinary ambient vision does: a person standing still who hears
          // nothing cannot tell a quiet street from a mode that has stopped
          // working, and hearing the same description again tells them.
          heartbeatMs: heartbeatMs ?? AMBIENT_QUIET_HEARTBEAT_MS,
          now,
        })
      ) {
        continue;
      }
      remembered.set(stream.id, { signature: frame.signature, sentAt: now });
      worthSending.push(frame.file);
    }
    // Streams that have ended keep no entry, so a long session does not grow
    // one signature per camera the person ever opened.
    const liveStreamIds = new Set(
      sources.filter(([stream]) => stream).map(([stream]) => stream.id)
    );
    for (const streamId of [...remembered.keys()]) {
      if (!liveStreamIds.has(streamId)) remembered.delete(streamId);
    }
    return worthSending;
  }, []);

  const captureShareStills = useCallback(async () => {
    const stills = await Promise.all([
      snapshotStream(webcamStreamRef.current, 'webcam.jpg'),
      snapshotStream(
        screenWatchedRef.current ? screenStreamRef.current : null,
        'screen.jpg'
      ),
    ]);
    return stills.filter(Boolean);
  }, []);

  /**
   * Capture one frame of each named source, right now.
   *
   * This is the fresh look the avatar asks for with `look_now`, so it skips
   * the ambient loop's unchanged-frame filter and its heartbeat entirely: the
   * answer to "what am I looking at" is the scene as it is at this instant,
   * whether or not the scene changed since the loop last sent a frame.
   *
   * @param {string[]} sources `'webcam'` / `'screen'`.
   * @returns {Promise<File[]>}
   */
  const captureNamedShareStills = useCallback(async (sources) => {
    const wanted = new Set(sources ?? []);
    const stills = await Promise.all([
      wanted.has('webcam')
        ? snapshotStream(webcamStreamRef.current, 'webcam.jpg')
        : null,
      wanted.has('screen')
        ? snapshotStream(screenStreamRef.current, 'screen.jpg')
        : null,
    ]);
    return stills.filter(Boolean);
  }, []);

  /**
   * Open the camera, take one frame, and close it again.
   *
   * The avatar's own look, permitted from avatar settings. The camera is live
   * only for as long as the frame takes; the person's camera light is the
   * signal that it happened. Nothing here starts a share: the stream is never
   * published as `webcamStream`, so the preview tile does not appear and the
   * ambient loop — which runs off a live share — never begins. An avatar that
   * may look is not thereby an avatar that may watch.
   *
   * @returns {Promise<File|null>} The frame, or null when the camera would not open.
   */
  const peekThroughCamera = useCallback(async () => {
    if (webcamStreamRef.current) {
      // Already shared: that is the ordinary path, not a peek.
      return snapshotStream(webcamStreamRef.current, 'webcam.jpg');
    }
    let stream = null;
    try {
      stream = await openCameraStream(webcamFacingRef.current);
      return await snapshotStream(stream, 'webcam.jpg');
    } catch (peekError) {
      // A browser with no standing grant refuses without a gesture. The avatar
      // is told the look was unavailable and says so; no toast, because the
      // person did not press anything to be told about.
      console.warn('The camera could not be opened for a look:', peekError);
      return null;
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
    }
  }, []);

  /**
   * Switch shares off on the avatar's say-so.
   *
   * @param {string[]} sources `'webcam'` / `'screen'`.
   * @returns {string[]} What was actually switched off.
   */
  const stopNamedShares = useCallback((sources) => {
    const wanted = new Set(sources ?? []);
    const stopped = [];
    if (wanted.has('webcam') && webcamStreamRef.current) {
      stopWebcam();
      stopped.push('webcam');
    }
    if (wanted.has('screen') && screenStreamRef.current) {
      // Either mode: a capture the person can see running in their browser's
      // sharing bar is a capture "stop looking at my screen" can really end.
      stopScreenCapture();
      stopped.push('screen');
    }
    return stopped;
  }, [stopScreenCapture]);

  // Publish what is live for the turn plumbing, which cannot read this context
  // directly (see `src/services/liveShareRegistry.js`). Every turn reports
  // these as `live_shares`, a `look_now` pause is answered by capturing (or
  // peeking) through this same registration, and the avatar switches a share
  // off through `stopNamedShares`.
  useEffect(() => {
    publishLiveShares({
      // Being SHARED: watched on the interval, and the avatar knows it as a
      // live source it may look at any time.
      sources: [
        ...(webcamStream ? ['webcam'] : []),
        ...(screenIsWatched ? ['screen'] : []),
      ],
      // Open to ONE look and nothing more. A screen capture running unwatched
      // belongs here rather than above: the avatar may glance at it when a
      // question needs the answer, and it is never snapshotted on a timer.
      // The camera is added by `MediaContext`, which holds the per-avatar
      // permission this registry cannot see.
      peekableSources:
        screenStream && !screenWatched ? ['screen'] : [],
      capture: captureNamedShareStills,
      peek: peekThroughCamera,
      peekDesktop: peekAtScreen,
      stop: stopNamedShares,
      // The button the avatar's request puts in front of the person starts a
      // PEEK capture, not a watched share. The avatar asked to see the screen
      // once; answering that by starting continuous watching would give away
      // far more than was asked for, and the person can promote it to a share
      // from the share controls whenever they want to.
      startScreenShare: toggleScreenPeek,
    });
  }, [
    webcamStream,
    screenStream,
    screenWatched,
    screenIsWatched,
    captureNamedShareStills,
    peekThroughCamera,
    peekAtScreen,
    stopNamedShares,
    toggleScreenPeek,
  ]);

  useEffect(() => resetLiveShares, []);

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

  // Nothing that holds the microphone shut may hold it shut indefinitely.
  //
  // The reset above is the mechanism; this is the backstop, because the cost of
  // the two disagreeing is not a glitch — it is a person who cannot speak to
  // their avatar and has no way to see why. No description takes anywhere near
  // this long to read, so a flag still set after it is a stranded one.
  useEffect(() => {
    if (!sceneNarrationSpeaking) return undefined;
    const release = setTimeout(() => {
      narrationSpeakingRef.current = false;
      setSceneNarrationSpeaking(false);
    }, NARRATION_SPEECH_CEILING_MS);
    return () => clearTimeout(release);
  }, [sceneNarrationSpeaking]);

  // The first share starting, or the last share ending, resets the look so
  // the countdown begins again on a new share.
  useEffect(() => {
    setAmbientStatus({ ...INITIAL_AMBIENT_STATUS });
  }, [hasLiveShare]);

  // One timer for the whole application. Every second it asks the scheduler
  // whether a capture is due; when one is, both live shares are snapshotted and
  // sent as one observation. A rate limit paces the next tick. Repeated
  // failures are reported once per outage; the looks keep going on the normal
  // interval for as long as the share is live, since there is no switch.
  useEffect(() => {
    if (!ambientAllowed || !ambientCaptureAllowed || !ambientEnabled) {
      setAmbientNextInMs(0);
      return undefined;
    }
    const sendMotionWindowAlone = async (motionTrack) => {
      try {
        const still = await snapshotStream(webcamStreamRef.current, 'webcam.jpg');
        const frameDataUri = still ? await fileToDataUri(still) : null;
        await postAvatarMotionTrack(motionAssistantIdRef.current, motionTrack, {
          cameraFacing: webcamFacingRef.current,
          frameDataUri,
        });
      } catch (motionError) {
        // Learning movement is quiet: a failed window is simply not learned.
        console.debug('Motion window not recorded:', motionError);
      }
    };
    let cancelled = false;
    const tick = async () => {
      const conditions = ambientConditionsRef.current;
      const status = ambientStatusRef.current;
      const now = Date.now();
      // Narration looks more often than ordinary ambient vision, because the
      // two are not the same thing: an ambient look is context the avatar may
      // never use, while a narrated look is the next thing a person walking
      // through a place they cannot see gets to know.
      const intervalMs = conditions.narrating
        ? conditions.narrationIntervalMs || SCENE_NARRATION_INTERVAL_MS
        : AMBIENT_CAPTURE_INTERVAL_MS;
      const heartbeatMs = conditions.narrating
        ? SCENE_NARRATION_HEARTBEAT_MS
        : AMBIENT_QUIET_HEARTBEAT_MS;
      setAmbientNextInMs(
        nextCaptureInMs({
          lastCaptureAt: status.lastCapturedAt,
          intervalMs,
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
          // A description still being read out is a reason to wait: capturing
          // over it would leave the person hearing a scene they have already
          // walked out of, and each one they hear should be the newest.
          ambientHold: conditions.ambientHold || narrationSpeakingRef.current,
          lastCaptureAt: status.lastCapturedAt,
          intervalMs,
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
        const stills = await captureAmbientStills(now, heartbeatMs);
        const motionTrack = takeMotionWindowRef.current?.({ emotion: 'neutral' });
        if (!stills.length) {
          // Nothing changed: the scene is noticed by not being sent at all.
          // The person may still have moved, though — a window that is due
          // goes on its own, with one still for the identity gate, so a
          // still room does not stop the avatar learning how its person moves.
          if (
            motionTrack &&
            motionAssistantIdRef.current &&
            webcamStreamRef.current &&
            webcamFacingRef.current === CAMERA_FACING_FRONT
          ) {
            await sendMotionWindowAlone(motionTrack);
          }
          apply({ type: 'done' });
          return;
        }
        const outcome = await conditions.sendAmbientObservation(stills, {
          voiceMode: ambientVoiceModeRef.current,
          cameraFacing: webcamFacingRef.current,
          motionTrack,
          // Marks this observation as one the person is waiting to hear. The
          // API describes it for a listener who cannot see it and answers it
          // without triage, rather than deciding whether it is worth a word.
          narrate: conditions.narrating,
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
        // A narrated observation is answered by nobody: the description IS
        // the reading and it rides the triage decision, arriving a whole
        // avatar turn earlier than a reply would.
        const narrated = conditions.narrating ? outcome?.narration : null;
        if (
          (narrated || outcome?.reply) &&
          (outcome.decision === 'respond' || outcome.decision === 'notify')
        ) {
          if (conditions.narrating) {
            // Narration does its own speaking even when voice mode is open,
            // and this is deliberate. Voice mode falls back to TEXT when the
            // avatar has no cloned voice, which is the correct answer for a
            // reply somebody can read and the wrong one for a description
            // somebody is relying on to cross a room. `speakNarration` always
            // ends in a voice: the avatar's if it has one, the browser's if
            // not.
            narrationSpeakingRef.current = true;
            setSceneNarrationSpeaking(true);
            try {
              // Read out unconditionally, mute included. The mute silences the
              // avatar's side of a CONVERSATION, which a person can choose to
              // do without losing anything they need; scene narration is not
              // that. Somebody who switched this on did so to be told what is
              // in front of them, and a mute they set an hour ago to stop the
              // avatar chattering must not quietly turn that off — the mode
              // itself is the switch for silence. Switching it on unmutes, so
              // the interface never shows a mute while narration is speaking.
              await speakNarration(
                conditions.assistantId,
                narrated || outcome.reply
              );
            } finally {
              narrationSpeakingRef.current = false;
              // Cleared unconditionally, and NOT behind the effect's
              // `cancelled` flag. This flag holds the microphone shut in voice
              // mode, and switching narration on re-runs this very effect —
              // opening the camera flips `ambientEnabled`, and the switch
              // itself flips `ambientCaptureAllowed` — so an utterance in
              // flight was routinely torn down mid-sentence, skipped this
              // reset, and left the microphone shut for the rest of the
              // session. Turning on the accessibility mode took away the
              // person's ability to speak at all.
              setSceneNarrationSpeaking(false);
            }
          } else {
            await ambientReplyHandlerRef.current?.(
              outcome.reply,
              outcome.sentiment,
              outcome.decision
            );
          }
        }
      } catch (observationError) {
        if (isObservationYield(observationError)) {
          // The person typed or spoke while this look was in flight and the
          // look was stopped for it: a quiet end, not a failure.
          apply({ type: 'done' });
          return;
        }
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
        if (shouldReportRepeatedFailures(next)) {
          toast.error(
            'Ambient vision cannot reach the avatar right now. It will keep trying while the share is live.'
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
  }, [ambientAllowed, ambientCaptureAllowed, ambientEnabled, captureAmbientStills]);

  return (
    <MediaShareContext.Provider
      value={{
        webcamStream,
        screenStream,
        webcamFacingMode,
        isFlippingWebcam,
        toggleWebcam,
        flipWebcam,
        toggleScreenShare,
        toggleScreenPeek,
        screenWatched,
        captureShareStills,
        ambientAllowed,
        ambientCaptureAllowed,
        ambientEnabled,
        ambientStatus,
        ambientNextInMs,
        ambientIntervalMs: AMBIENT_CAPTURE_INTERVAL_MS,
        motionFrame,
        motionMeshEdges,
        motionFrameSize,
        motionStatus,
        setAmbientVoiceMode,
        registerAmbientReplyHandler,
        // The standing setting, and whether it is actually running on a live
        // camera right now. The tiles show the second one; the Accessibility
        // page reflects the first, because a setting that switched itself off
        // every time a camera closed could not be a setting.
        sceneNarrationOn,
        sceneNarrationActive,
        setSceneNarration: setSceneNarrationOn,
        sceneNarrationSpeaking,
      }}
    >
      {children}
    </MediaShareContext.Provider>
  );
}

export function useMediaShare() {
  return useContext(MediaShareContext) ?? INACTIVE_SHARE;
}
