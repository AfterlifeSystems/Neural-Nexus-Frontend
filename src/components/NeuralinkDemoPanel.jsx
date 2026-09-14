// src/components/NeuralinkDemoPanel.jsx
//
// Developer showcase of a future Neuralink Link: reconstructed V1 sight and a
// right-wrist ECoG decoder. These switches attach to always-on simulation
// servers. They are not a share-rail camera and do not occupy webcamStream.

import React from 'react';
import { Eye, Hand } from 'lucide-react';
import Switch from './ui/Switch';
import useNeuralinkDemo from '../hooks/useNeuralinkDemo';

const NeuralinkDemoPanel = () => {
  const {
    assistantId,
    personalAvatar,
    sightEnabled,
    setSightEnabled,
    wristEnabled,
    setWristEnabled,
    jpegObjectUrl,
    v1Path,
    v1FrameIndex,
    trailPoints,
    motionPath,
    lastRecorded,
    sightError,
    wristError,
  } = useNeuralinkDemo();

  return (
    <div
      className="flex flex-col gap-5 pt-4 border-t border-white/10"
      data-neuralink-demo-panel
    >
      <div>
        <h3 className="text-base font-semibold text-neutral-100">
          Neuralink Link demo
        </h3>
        <p className="text-sm text-white/60 mt-1">
          Showcase of a future Link: reconstructed V1 sight and a decoded
          right-wrist reach. These attach to the always-on simulation servers.
          They are not Share webcam and they do not replace the live camera.
        </p>
        {!assistantId && (
          <p className="text-xs text-amber-200/80 mt-2">
            Select an avatar first. The decoder only records on a personal
            avatar.
          </p>
        )}
        {assistantId && !personalAvatar && (
          <p className="text-xs text-amber-200/80 mt-2">
            A neural decoder may only teach the signed-in owner&apos;s personal
            avatar. This avatar will refuse the wrist windows.
          </p>
        )}
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
            <Eye className="w-4 h-4 text-amber-300" aria-hidden />
            Demo V1 sight
          </h4>
          <p className="text-sm text-white/60 mt-1">
            Poll the V1 reconstruction server and send each still as ambient
            context (`webcam.jpg`, camera facing the world). Share webcam stays
            untouched. Similar frames are sent on the normal interval; they do
            not wait for a scene-change heartbeat.
          </p>
        </div>
        <Switch
          checked={sightEnabled}
          onChange={setSightEnabled}
          label="Demo V1 sight"
          showLabel
          onLabel="Attached"
          offLabel="Detached"
          disabled={!assistantId}
        />
      </div>
      {sightEnabled && (
        <div className="rounded-xl border border-white/10 bg-black/40 p-3">
          {jpegObjectUrl ? (
            <img
              src={jpegObjectUrl}
              alt="Reconstructed V1 still"
              className="w-full max-h-48 object-contain rounded-lg bg-black"
            />
          ) : (
            <p className="text-xs text-white/50">Waiting for the V1 server…</p>
          )}
          <p className="text-xs text-white/40 mt-2">
            path={v1Path ?? '…'}
            {v1FrameIndex != null ? ` · frame ${v1FrameIndex}` : ''}
          </p>
          {sightError && (
            <p className="text-xs text-amber-200/80 mt-1">{sightError}</p>
          )}
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
            <Hand className="w-4 h-4 text-amber-300" aria-hidden />
            Demo right-wrist decoder
          </h4>
          <p className="text-sm text-white/60 mt-1">
            Poll the CRCNS right-wrist server and record sparse
            `neural_decoder` windows on this avatar. The trail is drawn here,
            not over the webcam tile.
          </p>
        </div>
        <Switch
          checked={wristEnabled}
          onChange={setWristEnabled}
          label="Demo right-wrist decoder"
          showLabel
          onLabel="Attached"
          offLabel="Detached"
          disabled={!assistantId}
        />
      </div>
      {wristEnabled && (
        <div className="rounded-xl border border-white/10 bg-black/40 p-3">
          <DemoWristTrail points={trailPoints} />
          <p className="text-xs text-white/40 mt-2">
            path={motionPath ?? '…'}
            {lastRecorded?.recorded === true
              ? ' · recorded'
              : lastRecorded?.reason
                ? ` · ${lastRecorded.reason}`
                : ''}
          </p>
          {wristError && (
            <p className="text-xs text-amber-200/80 mt-1">{wristError}</p>
          )}
        </div>
      )}
    </div>
  );
};

const DemoWristTrail = ({ points }) => {
  const width = 280;
  const height = 140;
  const polyline = points
    .map((point) => `${point.x * width},${point.y * height}`)
    .join(' ');
  const latest = points[points.length - 1];
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-36 rounded-lg bg-black"
      role="img"
      aria-label="Decoded right-wrist trail"
    >
      {polyline && (
        <polyline
          points={polyline}
          fill="none"
          stroke="rgb(252 211 77)"
          strokeWidth="2"
        />
      )}
      {latest && (
        <circle
          cx={latest.x * width}
          cy={latest.y * height}
          r="5"
          fill="rgb(253 230 138)"
        />
      )}
    </svg>
  );
};

export default NeuralinkDemoPanel;
