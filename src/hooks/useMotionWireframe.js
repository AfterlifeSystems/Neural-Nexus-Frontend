import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MOTION_BODY_FPS,
  MOTION_FACE_FPS,
  MOTION_FACE_MODEL_URL,
  MOTION_POSE_MODEL_URL,
  MOTION_TASKS_VISION_MODULE_URL,
  MOTION_TASKS_VISION_WASM_URL,
  MOTION_TRACK_MAX_BYTES,
  MOTION_TRACK_WINDOW_SECONDS,
  MOTION_WIREFRAME_ENABLED,
} from '../config/motionWireframe';
import {
  MotionWindowAccumulator,
  bodyFrameFromLandmarks,
  decodeBasis,
  faceFrameFromLandmarks,
  headPoseFromMatrix,
  overlayPoints,
  windowByteLength,
} from '../services/motionWireframe';

/**
 * Wireframe the person over a live webcam stream.
 *
 * Runs MediaPipe's PoseLandmarker and FaceLandmarker (WASM, in this tab) on
 * the stream at the configured rates, keeps the latest points for the
 * overlay, and accumulates windows for the API. Nothing is sent from here:
 * the ambient loop calls `takeWindow()` when it sends its next observation, so
 * the window rides a request that was leaving anyway. When the API has fitted
 * the avatar's expression basis (`loadBasis`), face frames are encoded to
 * coefficients here and the dense mesh stops crossing the wire.
 *
 * @param {MediaStream|null} stream the webcam stream, or null when off
 * @param {{enabled?: boolean, basis?: object|null}} [options]
 */
export default function useMotionWireframe(stream, { enabled = true, basis = null } = {}) {
  const [points, setPoints] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | running | unsupported | error
  const accumulatorRef = useRef(null);
  const latestRef = useRef({ body: null, face: null });
  const active = MOTION_WIREFRAME_ENABLED && enabled && Boolean(stream);

  if (!accumulatorRef.current) {
    accumulatorRef.current = new MotionWindowAccumulator({
      faceRateHz: MOTION_FACE_FPS,
      bodyRateHz: MOTION_BODY_FPS,
      windowSeconds: MOTION_TRACK_WINDOW_SECONDS,
    });
  }

  useEffect(() => {
    accumulatorRef.current?.setBasis(basis ? decodeBasis(basis) : null);
  }, [basis]);

  useEffect(() => {
    if (!active) {
      setStatus('idle');
      setPoints([]);
      accumulatorRef.current?.reset();
      return undefined;
    }
    let cancelled = false;
    let video = null;
    let pose = null;
    let face = null;
    let frameHandle = null;
    let lastOverlayAt = 0;

    const stop = () => {
      cancelled = true;
      if (frameHandle != null && video?.cancelVideoFrameCallback) {
        video.cancelVideoFrameCallback(frameHandle);
      }
      try {
        pose?.close();
        face?.close();
      } catch {
        // closing twice is harmless
      }
      if (video) {
        video.srcObject = null;
      }
    };

    const onFrame = () => {
      if (cancelled || !video) return;
      const now = performance.now();
      const accumulator = accumulatorRef.current;
      let bodyFrame = null;
      let faceFrame = null;
      let headPose = null;
      try {
        if (pose && accumulator.wantsBody(now)) {
          const result = pose.detectForVideo(video, now);
          bodyFrame = bodyFrameFromLandmarks(result?.landmarks?.[0]);
        }
        if (face && accumulator.wantsFace(now)) {
          const result = face.detectForVideo(video, now);
          faceFrame = faceFrameFromLandmarks(result?.faceLandmarks?.[0]);
          const matrix = result?.facialTransformationMatrixes?.[0];
          headPose = matrix ? headPoseFromMatrix(matrix) : null;
        }
      } catch (detectError) {
        // One bad frame is not a reason to stop; the next frame is a fresh try.
        console.debug('motion wireframe frame skipped', detectError);
      }
      if (bodyFrame || faceFrame) {
        accumulator.push(now, { body: bodyFrame, face: faceFrame, headPose });
        if (bodyFrame) latestRef.current.body = bodyFrame;
        if (faceFrame) latestRef.current.face = faceFrame;
        if (now - lastOverlayAt > 66) {
          lastOverlayAt = now;
          setPoints(overlayPoints(latestRef.current));
        }
      }
      frameHandle = video.requestVideoFrameCallback
        ? video.requestVideoFrameCallback(onFrame)
        : requestAnimationFrame(onFrame);
    };

    (async () => {
      setStatus('loading');
      try {
        // A runtime URL, deliberately opaque to Vite (see config/motionWireframe.js).
        const { FilesetResolver, PoseLandmarker, FaceLandmarker } = await import(
          /* @vite-ignore */ MOTION_TASKS_VISION_MODULE_URL
        );
        const fileset = await FilesetResolver.forVisionTasks(MOTION_TASKS_VISION_WASM_URL);
        [pose, face] = await Promise.all([
          PoseLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: MOTION_POSE_MODEL_URL, delegate: 'GPU' },
            runningMode: 'VIDEO',
            numPoses: 1,
          }),
          FaceLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: MOTION_FACE_MODEL_URL, delegate: 'GPU' },
            runningMode: 'VIDEO',
            numFaces: 1,
            outputFacialTransformationMatrixes: true,
            outputFaceBlendshapes: false,
          }),
        ]);
        if (cancelled) {
          stop();
          return;
        }
        video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.srcObject = stream;
        await video.play();
        setStatus('running');
        frameHandle = video.requestVideoFrameCallback
          ? video.requestVideoFrameCallback(onFrame)
          : requestAnimationFrame(onFrame);
      } catch (loadError) {
        console.warn('motion wireframe unavailable', loadError);
        setStatus(
          /WebGL|WebAssembly|not supported/i.test(String(loadError?.message ?? loadError))
            ? 'unsupported'
            : 'error'
        );
      }
    })();

    return stop;
  }, [active, stream]);

  /**
   * Serialize the accumulated window for the next ambient observation.
   * Returns `null` when there is nothing yet or the window is not due.
   * @param {{emotion?: string, force?: boolean}} [options]
   */
  const takeWindow = useCallback(({ emotion = 'neutral', force = false } = {}) => {
    const accumulator = accumulatorRef.current;
    if (!accumulator || accumulator.isEmpty) return null;
    if (!force && !accumulator.isDue(performance.now())) return null;
    const payload = accumulator.take({ emotion });
    if (!payload) return null;
    // A dense bootstrap window past the ceiling is thinned to every other face
    // frame rather than dropped: less resolution beats no window.
    if (windowByteLength(payload) > MOTION_TRACK_MAX_BYTES && payload.streams.face) {
      return decimateFace(payload);
    }
    return payload;
  }, []);

  return { points, status, takeWindow };
}

function decimateFace(payload) {
  const face = payload.streams.face;
  const head = payload.streams.head_pose;
  const thin = (stream) => {
    const bytes = Uint8Array.from(atob(stream.data_b64), (character) => character.charCodeAt(0));
    const frameBytes = stream.values_per_frame * 2;
    const kept = [];
    for (let frame = 0; frame < stream.frame_count; frame += 2) {
      kept.push(bytes.subarray(frame * frameBytes, (frame + 1) * frameBytes));
    }
    const out = new Uint8Array(kept.length * frameBytes);
    kept.forEach((chunk, index) => out.set(chunk, index * frameBytes));
    let binary = '';
    for (let index = 0; index < out.length; index += 0x8000) {
      binary += String.fromCharCode.apply(null, out.subarray(index, index + 0x8000));
    }
    return {
      ...stream,
      sample_rate_hz: stream.sample_rate_hz / 2,
      frame_count: kept.length,
      data_b64: btoa(binary),
    };
  };
  return {
    ...payload,
    streams: {
      ...payload.streams,
      face: thin(face),
      ...(head ? { head_pose: thin(head) } : {}),
    },
  };
}
