import React from 'react';
import { useMediaShare } from '../context/MediaShareContext';

/**
 * Live webcam and screen tiles in the message area.
 */
const MediaSharePreviews = ({ className = '' }) => {
  const { webcamStream, screenStream, webcamVideoRef, screenVideoRef } =
    useMediaShare();

  if (!webcamStream && !screenStream) return null;

  return (
    <div
      className={`flex flex-col items-end gap-2 pointer-events-none ${className}`}
    >
      {screenStream && (
        <video
          ref={screenVideoRef}
          autoPlay
          muted
          playsInline
          aria-label="Shared screen"
          className="w-40 sm:w-56 rounded-lg border border-white/20 bg-black shadow-lg"
        />
      )}
      {webcamStream && (
        <video
          ref={webcamVideoRef}
          autoPlay
          muted
          playsInline
          aria-label="Webcam"
          className="w-28 sm:w-36 rounded-lg border border-white/20 bg-black shadow-lg"
        />
      )}
    </div>
  );
};

export default MediaSharePreviews;
