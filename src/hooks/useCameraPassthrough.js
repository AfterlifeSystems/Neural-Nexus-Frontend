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

import { useEffect, useState } from 'react';

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
 * @param {boolean} enabled Whether the camera should be running.
 * @returns {{stream: MediaStream|null, error: Error|null}}
 */
export function useCameraPassthrough(enabled) {
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) return undefined;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError(new Error('This browser cannot open the camera.'));
      return undefined;
    }

    let isMounted = true;
    let openedStream = null;

    (async () => {
      try {
        // The rear camera is what shows the place on a phone; a desktop has
        // only the webcam, and `ideal` lets it fall back rather than throw.
        openedStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (!isMounted) {
          openedStream.getTracks().forEach((track) => track.stop());
          return;
        }
        setStream(openedStream);
        setError(null);
      } catch (cameraError) {
        if (isMounted) {
          setStream(null);
          setError(cameraError);
        }
      }
    })();

    return () => {
      isMounted = false;
      setStream(null);
      openedStream?.getTracks().forEach((track) => track.stop());
    };
  }, [enabled]);

  return { stream, error };
}

export default useCameraPassthrough;
