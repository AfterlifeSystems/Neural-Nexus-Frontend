import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMediaShare } from '../context/MediaShareContext';
import LiveShareVideo from './LiveShareVideo';
import { subscribeSharePreviewSlots } from './sharePreviewSlots';
import { describeAmbientStatus } from '../services/ambientCaptureScheduler';

/**
 * Play the live webcam and screen shares in the sidebar, not over the chat.
 */
const SharePreviewOutlet = () => {
  const {
    webcamStream,
    screenStream,
    ambientEnabled,
    ambientStatus,
    ambientNextInMs,
  } = useMediaShare();
  const [slots, setSlots] = useState({ rail: null, panel: null });
  const ambientLabel = ambientEnabled
    ? describeAmbientStatus(ambientStatus, ambientNextInMs)
    : '';

  useEffect(() => subscribeSharePreviewSlots(setSlots), []);

  if (!webcamStream && !screenStream) return null;

  return (
    <>
      {slots.rail &&
        createPortal(
          <SidebarShareTiles
            webcamStream={webcamStream}
            screenStream={screenStream}
            size="rail"
            ambientLabel={ambientLabel}
          />,
          slots.rail
        )}
      {slots.panel &&
        createPortal(
          <SidebarShareTiles
            webcamStream={webcamStream}
            screenStream={screenStream}
            size="panel"
            ambientLabel={ambientLabel}
          />,
          slots.panel
        )}
    </>
  );
};

function SidebarShareTiles({ webcamStream, screenStream, size, ambientLabel }) {
  const isRail = size === 'rail';
  return (
    <div
      className={
        isRail
          ? 'flex flex-col items-center gap-1 w-full'
          : 'flex flex-col gap-2'
      }
    >
      {!isRail && (
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wide">
          Sharing
        </h2>
      )}
      {screenStream && (
        <LiveShareVideo
          stream={screenStream}
          label="Shared screen"
          className={
            isRail
              ? 'w-11 h-8 rounded-md border border-white/20 bg-black object-cover'
              : 'w-full aspect-video rounded-lg border border-white/20 bg-black object-cover touch-pan-y'
          }
        />
      )}
      {webcamStream && (
        <LiveShareVideo
          stream={webcamStream}
          label="Webcam"
          className={
            isRail
              ? 'w-11 h-11 rounded-md border border-white/20 bg-black object-cover'
              : 'w-full aspect-square max-h-44 rounded-lg border border-white/20 bg-black object-cover touch-pan-y'
          }
        />
      )}
      {ambientLabel && (
        <p
          className={
            isRail
              ? 'sr-only'
              : 'text-[11px] text-amber-300/80 leading-tight'
          }
          aria-live="polite"
        >
          Ambient vision: {ambientLabel}
        </p>
      )}
    </div>
  );
}

export default SharePreviewOutlet;
