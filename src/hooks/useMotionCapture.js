// src/hooks/useMotionCapture.js
import { useCallback, useEffect, useState } from 'react';
import {
  readMotionCapture,
  subscribeMotionCapture,
  writeMotionCapture,
} from '../config/motionCapture';

/**
 * The motion-capture switch, live: whether this browser learns how the
 * person moves from the webcam, and a way to flip it.
 *
 * Every reader sees the same switch, whichever settings screen flipped it.
 *
 * @returns {{motionCaptureEnabled: boolean, setMotionCaptureEnabled: (enabled: boolean) => void}}
 */
export default function useMotionCapture() {
  const [motionCaptureEnabled, setEnabled] = useState(() => readMotionCapture());
  useEffect(() => {
    setEnabled(readMotionCapture());
    return subscribeMotionCapture((enabled) => setEnabled(Boolean(enabled)));
  }, []);
  const setMotionCaptureEnabled = useCallback((enabled) => {
    writeMotionCapture(enabled);
  }, []);
  return { motionCaptureEnabled, setMotionCaptureEnabled };
}
