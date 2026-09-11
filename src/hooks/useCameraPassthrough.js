// src/hooks/useCameraPassthrough.js
//
// The live camera behind a geo-located avatar in voice mode: the place the
// person is standing in, with the avatar over it.
//
// This is deliberately its own stream rather than the webcam share in
// MediaShareContext. That share arms ambient vision — snapshots sent to the
// avatar on a timer — and portals a preview tile into the sidebar. A backdrop
// is neither of those things: nothing here is ever sent anywhere, and the
// stream stops the moment the backdrop is turned off or the stage closes, so
// the camera indicator never outlives what the person can see.

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  CAMERA_FACING_REAR,
  MOBILE_CAMERA_VIEW_QUERY,
  isMobileCameraView,
  openCameraStream,
  oppositeCameraFacing,
} from '../services/cameraFacing';

/**
 * Whether this browser can put a live camera behind the avatar at all.
 *
 * `getUserMedia` is absent on an insecure origin and in some in-app browsers,
 * so the toggle is only offered where pressing it could do something.
 *
 * @returns {boolean}
 */
export function canShowCameraBackground() {
  if (typeof navigator === 'undefined') return false;
  return typeof navigator.mediaDevices?.getUserMedia === 'function';
}

/**
 * Whether this layout should offer a front/rear camera flip.
 *
 * Phones and tablets have two cameras. A narrow window is treated the same
 * so a device-toolbar "mobile view" gets the control too.
 *
 * @returns {boolean}
 */
export function useMobileCameraView() {
  const [isMobile, setIsMobile] = useState(() => isMobileCameraView());

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const query = window.matchMedia(MOBILE_CAMERA_VIEW_QUERY);
    const onChange = (event) => setIsMobile(event.matches);
    setIsMobile(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}

/**
 * @param {boolean} enabled Whether the camera should be running.
 * @returns {{
 *   stream: MediaStream|null,
 *   error: Error|null,
 *   facingMode: 'user'|'environment',
 *   flipCamera: () => Promise<boolean>,
 *   isFlipping: boolean,
 * }}
 */
export function useCameraPassthrough(enabled) {
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [facingMode, setFacingMode] = useState(CAMERA_FACING_REAR);
  const [isFlipping, setIsFlipping] = useState(false);
  const streamRef = useRef(null);
  const facingRef = useRef(CAMERA_FACING_REAR);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const stopCurrentStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    if (!enabled) {
      stopCurrentStream();
      setStream(null);
      setError(null);
      setFacingMode(CAMERA_FACING_REAR);
      facingRef.current = CAMERA_FACING_REAR;
      return undefined;
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError(new Error('This browser cannot open the camera.'));
      return undefined;
    }

    let isMounted = true;

    (async () => {
      try {
        // The rear camera is what shows the place on a phone; a desktop has
        // only the webcam, and `ideal` lets it fall back rather than throw.
        const openedStream = await openCameraStream(facingRef.current);
        if (!isMounted) {
          openedStream.getTracks().forEach((track) => track.stop());
          return;
        }
        stopCurrentStream();
        streamRef.current = openedStream;
        setStream(openedStream);
        setError(null);
      } catch (cameraError) {
        if (isMounted) {
          stopCurrentStream();
          setStream(null);
          setError(cameraError);
        }
      }
    })();

    return () => {
      isMounted = false;
      stopCurrentStream();
      setStream(null);
    };
  }, [enabled]);

  const flipCamera = useCallback(async () => {
    if (!enabledRef.current || isFlipping || !streamRef.current) return false;
    const nextFacing = oppositeCameraFacing(facingRef.current);
    const previousFacing = facingRef.current;
    setIsFlipping(true);
    // Phones rarely allow two cameras at once, so the live one has to stop
    // before the other can open.
    stopCurrentStream();
    setStream(null);
    try {
      const openedStream = await openCameraStream(nextFacing);
      if (!enabledRef.current) {
        openedStream.getTracks().forEach((track) => track.stop());
        return false;
      }
      streamRef.current = openedStream;
      facingRef.current = nextFacing;
      setFacingMode(nextFacing);
      setStream(openedStream);
      setError(null);
      return true;
    } catch {
      if (!enabledRef.current) return false;
      try {
        const restoredStream = await openCameraStream(previousFacing);
        if (!enabledRef.current) {
          restoredStream.getTracks().forEach((track) => track.stop());
          return false;
        }
        streamRef.current = restoredStream;
        setStream(restoredStream);
      } catch (restoreError) {
        setStream(null);
        setError(restoreError);
      }
      return false;
    } finally {
      setIsFlipping(false);
    }
  }, [isFlipping]);

  return { stream, error, facingMode, flipCamera, isFlipping };
}

export default useCameraPassthrough;
