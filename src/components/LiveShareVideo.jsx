import { useEffect, useRef } from 'react';

/**
 * Play a live MediaStream in its own video element.
 *
 * Webcam and screen previews used to share one ref from context. Voice mode
 * and the chat both mount a tile, so the last one stole the ref and the
 * visible video never received the stream.
 *
 * @param {{ stream: MediaStream, className?: string, label: string }} props
 */
const LiveShareVideo = ({ stream, className = '', label }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return undefined;
    video.srcObject = stream;
    video.play()?.catch(() => {
      // autoPlay + muted is enough in a user-gesture path; play() is a
      // fallback for phones that ignore the attribute until srcObject is set.
    });
    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      draggable={false}
      aria-label={label}
      className={className}
    />
  );
};

export default LiveShareVideo;
