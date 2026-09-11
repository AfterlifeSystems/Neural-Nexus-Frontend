import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMediaShare } from '../context/MediaShareContext';
import LiveShareVideo from './LiveShareVideo';
import MotionWireframeOverlay from './MotionWireframeOverlay';
import { MOTION_WIREFRAME_OVERLAY } from '../config/motionWireframe';
import { openCollapsedSidebar, subscribeSharePreviewSlots } from './sharePreviewSlots';
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
    motionPoints,
    motionStatus,
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
            motionPoints={motionPoints}
            motionStatus={motionStatus}
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
            motionPoints={motionPoints}
            motionStatus={motionStatus}
          />,
          slots.panel
        )}
    </>
  );
};

/**
 * Rail tiles open the sidebar. The click is sent to the rail itself so a
 * wrapping well cannot swallow it the way mute / share icons keep theirs.
 */
function renderShareTile({ stream, label, isRail, className, overlayPoints = null }) {
  const plainVideo = (
    <LiveShareVideo
      stream={stream}
      label={label}
      className={className}
      decorative
    />
  );
  // The wireframe sits over the webcam tile only: the same green landmarks
  // the person's own prototype drew, so it is visible that movement is being
  // learned while the camera faces them.
  const video =
    overlayPoints && MOTION_WIREFRAME_OVERLAY ? (
      <div className={`relative ${isRail ? 'w-11 h-11' : 'w-24 h-24 shrink-0 sm:w-full sm:h-auto sm:aspect-square sm:max-h-44'}`}>
        <LiveShareVideo
          stream={stream}
          label={label}
          className={`${className} !w-full !h-full`}
          decorative
        />
        <MotionWireframeOverlay points={overlayPoints} />
      </div>
    ) : (
      plainVideo
    );
  if (!isRail) return video;
  return (
    <button
      type="button"
      title="Open the sidebar and show this preview"
      aria-label={`Open the sidebar — ${label}`}
      className="p-0! border-0! bg-transparent cursor-pointer rounded-md focus:outline-none focus:ring-2 focus:ring-amber-400/50"
      onClick={(event) => {
        event.stopPropagation();
        openCollapsedSidebar(event.currentTarget);
      }}
    >
      {video}
    </button>
  );
}

function SidebarShareTiles({ webcamStream, screenStream, size, ambientLabel, motionPoints, motionStatus }) {
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
      {!isRail && (
        <div className="flex flex-row sm:flex-col gap-2 items-start sm:items-stretch">
          {screenStream &&
            renderShareTile({
              stream: screenStream,
              label: 'Shared screen',
              isRail: false,
              className:
                'min-w-0 flex-1 sm:flex-none sm:w-full aspect-video max-h-24 sm:max-h-none rounded-lg border border-white/20 bg-black object-cover touch-pan-y',
            })}
          {webcamStream &&
            renderShareTile({
              stream: webcamStream,
              label: 'Webcam',
              isRail: false,
              className:
                'w-24 h-24 shrink-0 sm:w-full sm:h-auto sm:aspect-square sm:max-h-44 rounded-lg border border-white/20 bg-black object-cover touch-pan-y',
              overlayPoints: motionStatus === 'running' ? motionPoints : null,
            })}
        </div>
      )}
      {isRail && screenStream &&
        renderShareTile({
          stream: screenStream,
          label: 'Shared screen',
          isRail,
          className:
            'w-11 h-8 rounded-md border border-white/20 bg-black object-cover',
        })}
      {isRail && webcamStream &&
        renderShareTile({
          stream: webcamStream,
          label: 'Webcam',
          isRail,
          className:
            'w-11 h-11 rounded-md border border-white/20 bg-black object-cover',
          overlayPoints: motionStatus === 'running' ? motionPoints : null,
        })}
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
      {webcamStream && motionStatus && motionStatus !== 'idle' && (
        <p className={isRail ? 'sr-only' : 'text-[11px] text-emerald-300/80 leading-tight'}>
          {motionStatus === 'running'
            ? 'Learning how you move'
            : motionStatus === 'loading'
              ? 'Loading the wireframe…'
              : 'Wireframe unavailable in this browser'}
        </p>
      )}
    </div>
  );
}

export default SharePreviewOutlet;
