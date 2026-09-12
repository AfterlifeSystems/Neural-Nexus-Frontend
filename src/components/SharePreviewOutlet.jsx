import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMediaShare } from '../context/MediaShareContext';
import LiveShareVideo from './LiveShareVideo';
import MotionWireframeOverlay from './MotionWireframeOverlay';
import { MOTION_WIREFRAME_OVERLAY } from '../config/motionWireframe';
import { openCollapsedSidebar, subscribeSharePreviewSlots } from './sharePreviewSlots';
import { describeAmbientStatus } from '../services/ambientCaptureScheduler';

/**
 * Play the live webcam and screen capture in the sidebar, not over the chat.
 *
 * A screen capture running in PEEK mode is shown here like any other, because
 * seeing what has been handed over is the whole point of these tiles — but it
 * is not labelled as being shared, because it is not. Nothing reads it until
 * the avatar asks a question that needs a look; `screenWatched` is what tells
 * the two apart.
 */
const SharePreviewOutlet = () => {
  const {
    webcamStream,
    screenStream,
    screenWatched,
    ambientEnabled,
    ambientStatus,
    ambientNextInMs,
    motionFrame,
    motionMeshEdges,
    motionFrameSize,
    motionStatus,
    sceneNarrationActive,
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
            screenWatched={screenWatched}
            size="rail"
            ambientLabel={ambientLabel}
            motionFrame={motionFrame}
            motionMeshEdges={motionMeshEdges}
            motionFrameSize={motionFrameSize}
            motionStatus={motionStatus}
            sceneNarrationActive={sceneNarrationActive}
          />,
          slots.rail
        )}
      {slots.panel &&
        createPortal(
          <SidebarShareTiles
            webcamStream={webcamStream}
            screenStream={screenStream}
            screenWatched={screenWatched}
            size="panel"
            ambientLabel={ambientLabel}
            motionFrame={motionFrame}
            motionMeshEdges={motionMeshEdges}
            motionFrameSize={motionFrameSize}
            motionStatus={motionStatus}
            sceneNarrationActive={sceneNarrationActive}
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
function renderShareTile({
  stream,
  label,
  isRail,
  className,
  overlay = null,
  narrating = false,
}) {
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
    overlay && MOTION_WIREFRAME_OVERLAY ? (
      <div className={`relative ${isRail ? 'w-11 h-11' : 'w-24 h-24 shrink-0 sm:w-full sm:h-auto sm:aspect-square sm:max-h-44'}`}>
        <LiveShareVideo
          stream={stream}
          label={label}
          className={`${className} !w-full !h-full`}
          decorative
        />
        <MotionWireframeOverlay
          frame={overlay.frame}
          meshEdges={overlay.meshEdges}
          frameSize={overlay.frameSize}
        />
      </div>
    ) : (
      plainVideo
    );
  // The describing indicator rides ON the camera tile, because the camera is
  // what the setting changes: an amber ring plus a dot that is visible at rail
  // size, where a word would not fit. It appears only while descriptions are
  // actually being spoken from this camera, so closing the camera clears it.
  const framed = narrating ? (
    <span className="relative inline-flex rounded-md ring-2 ring-amber-400/70">
      {video}
      <span
        aria-hidden="true"
        className={
          isRail
            ? 'absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-black/80'
            : 'absolute top-1 left-1 px-1.5 py-0.5 rounded-full bg-amber-400/90 text-neutral-900 text-[10px] font-semibold leading-none'
        }
      >
        {isRail ? '' : 'Describing'}
      </span>
      <span className="sr-only">
        {`${label} — your surroundings are being described out loud`}
      </span>
    </span>
  ) : (
    video
  );
  if (!isRail) return framed;
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
      {framed}
    </button>
  );
}

function SidebarShareTiles({
  webcamStream,
  screenStream,
  screenWatched,
  size,
  ambientLabel,
  motionFrame,
  motionMeshEdges,
  motionFrameSize,
  motionStatus,
  sceneNarrationActive = false,
}) {
  const isRail = size === 'rail';
  // A screen capture the avatar may only glance at must not call itself
  // shared. The heading follows the same rule: with nothing being watched,
  // nothing here is being shared.
  const screenLabel = screenWatched ? 'Shared screen' : 'Screen (looks only)';
  const anythingIsWatched = Boolean(webcamStream) || Boolean(screenWatched);
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
          {anythingIsWatched ? 'Sharing' : 'Open to a look'}
        </h2>
      )}
      {!isRail && (
        <div className="flex flex-row sm:flex-col gap-2 items-start sm:items-stretch">
          {screenStream &&
            renderShareTile({
              stream: screenStream,
              label: screenLabel,
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
              overlay:
                motionStatus === 'running'
                  ? {
                      frame: motionFrame,
                      meshEdges: motionMeshEdges,
                      frameSize: motionFrameSize,
                    }
                  : null,
              narrating: sceneNarrationActive,
            })}
        </div>
      )}
      {isRail && screenStream &&
        renderShareTile({
          stream: screenStream,
          label: screenLabel,
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
          overlay:
            motionStatus === 'running'
              ? {
                  frame: motionFrame,
                  meshEdges: motionMeshEdges,
                  frameSize: motionFrameSize,
                }
              : null,
          narrating: sceneNarrationActive,
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
      {webcamStream && sceneNarrationActive && (
        <p
          className={
            isRail ? 'sr-only' : 'text-[11px] text-amber-300/90 leading-tight'
          }
          aria-live="polite"
        >
          Describing your surroundings out loud. Turning the camera off stops
          it.
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
