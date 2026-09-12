// src/components/media/MotionCaptureSection.jsx
//
// The switch for learning how the person moves from the webcam, shown in
// account settings and in the personal avatar's settings. Both render this
// one component over the one stored choice, so flipping either flips both.

import React from 'react';
import { Activity } from 'lucide-react';
import Switch from '../ui/Switch';
import useMotionCapture from '../../hooks/useMotionCapture';
import { useMediaShare } from '../../context/MediaShareContext';

/**
 * @param {Object} props
 * @param {'avatar_settings'|'account_settings'} props.source Where this
 *   switch lives; marks the section for tests and styling only.
 * @param {string} [props.avatarName] The personal avatar's name, when known.
 * @param {boolean} [props.embedded] Render without the card chrome, for a
 *   place that already has a card around it (the Motion panel).
 */
const MotionCaptureSection = ({ source, avatarName, embedded = false }) => {
  const { motionCaptureEnabled, setMotionCaptureEnabled } = useMotionCapture();
  const { webcamStream, motionStatus } = useMediaShare();

  const statusLine = !motionCaptureEnabled
    ? 'Off. Nothing about how you move is recorded.'
    : !webcamStream
      ? 'On. Recording starts when your webcam is on and facing you while an avatar is open.'
      : motionStatus === 'running'
        ? 'On and recording from your webcam now.'
        : motionStatus === 'loading'
          ? 'On. Getting ready to read your webcam…'
          : motionStatus === 'unsupported' || motionStatus === 'error'
            ? 'On, but this browser cannot run the movement tracker.'
            : 'On. Waiting for a front-facing camera and an open avatar.';

  const body = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          {!embedded && (
            <Activity size={20} className="text-amber-400/80 shrink-0 mt-0.5" />
          )}
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-neutral-100">
              Learn how I move
            </h3>
            <p className="text-sm text-white/60 mt-1">
              While this is on and your webcam faces you, the browser tracks
              your body and face — 33 joints and a mesh of the face — and sends
              short windows of that movement to{' '}
              {avatarName ?? 'your personal avatar'} so its stills, idle loops
              and lip-synced clips move the way you do. Only the tracked points
              are sent, in the browser, not video. Nothing is recorded from a
              screen share or a rear camera.
            </p>
          </div>
        </div>
        <Switch
          checked={motionCaptureEnabled}
          onChange={setMotionCaptureEnabled}
          label="Learn how I move"
          showLabel
          onLabel="On"
          offLabel="Off"
        />
      </div>
      <p role="status" aria-live="polite" className="mt-3 text-xs text-white/50">
        {statusLine}
      </p>
      <p className="mt-2 text-xs text-white/40">
        Remembered for this browser only. Turn it on again on any other device
        you want it on. What has already been learned can be deleted from the
        Motion section of {avatarName ?? 'your personal avatar'}&apos;s settings.
      </p>
    </>
  );

  if (embedded) {
    return (
      <div
        className="pt-4 border-t border-white/10"
        data-motion-capture-section={source}
      >
        {body}
      </div>
    );
  }
  return (
    <div
      className="bg-black/60 backdrop-blur-lg rounded-2xl border border-white/10 p-6"
      data-motion-capture-section={source}
    >
      {body}
    </div>
  );
};

export default MotionCaptureSection;
