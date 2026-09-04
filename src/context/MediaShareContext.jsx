import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { toast } from 'react-hot-toast';

const MediaShareContext = createContext(null);

const INACTIVE_SHARE = {
  webcamStream: null,
  screenStream: null,
  webcamVideoRef: { current: null },
  screenVideoRef: { current: null },
  toggleWebcam: async () => {},
  toggleScreenShare: async () => {},
  captureShareStills: async () => [],
};

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

export function MediaShareProvider({ children }) {
  const [webcamStream, setWebcamStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const webcamVideoRef = useRef(null);
  const screenVideoRef = useRef(null);
  const webcamStreamRef = useRef(null);
  const screenStreamRef = useRef(null);

  useEffect(() => {
    if (webcamVideoRef.current) {
      webcamVideoRef.current.srcObject = webcamStream;
    }
  }, [webcamStream]);

  useEffect(() => {
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = screenStream;
    }
  }, [screenStream]);

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
    if (!navigator.mediaDevices?.getDisplayMedia) {
      toast.error('This browser cannot share the screen.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        screenStreamRef.current = null;
        setScreenStream(null);
      });
      screenStreamRef.current = stream;
      setScreenStream(stream);
    } catch (screenError) {
      if (screenError?.name === 'NotAllowedError') {
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

  return (
    <MediaShareContext.Provider
      value={{
        webcamStream,
        screenStream,
        webcamVideoRef,
        screenVideoRef,
        toggleWebcam,
        toggleScreenShare,
        captureShareStills,
      }}
    >
      {children}
    </MediaShareContext.Provider>
  );
}

export function useMediaShare() {
  return useContext(MediaShareContext) ?? INACTIVE_SHARE;
}
