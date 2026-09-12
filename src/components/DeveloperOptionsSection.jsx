// src/components/DeveloperOptionsSection.jsx
//
// Developer options in account settings: the administrator, in a development
// build, and nobody else. Renders nothing otherwise, so the account settings
// screen can include this unconditionally.

import React from 'react';
import { Wrench } from 'lucide-react';
import Switch from './ui/Switch';
import useMotionMeshDeveloperOverlay from '../hooks/useMotionMeshDeveloperOverlay';
import useMotionCapture from '../hooks/useMotionCapture';
import { MOTION_WIREFRAME_OVERLAY } from '../config/motionWireframe';

const DeveloperOptionsSection = () => {
  const { offered, shown, setShown } = useMotionMeshDeveloperOverlay();
  const { motionCaptureEnabled } = useMotionCapture();
  if (!offered) return null;

  return (
    <section
      aria-labelledby="developer-options-heading"
      className="flex flex-col gap-4 bg-black/60 border border-white/10 rounded-2xl p-6"
      data-developer-options-section
    >
      <header className="flex items-center gap-3">
        <Wrench className="w-5 h-5 shrink-0 text-amber-300" aria-hidden />
        <h2
          id="developer-options-heading"
          className="text-xl font-semibold text-neutral-100"
        >
          Developer options
        </h2>
        <span className="rounded-full border border-amber-400/40 bg-amber-400/15 px-2 py-px text-[10px] uppercase tracking-wide text-amber-200">
          Dev build · administrator
        </span>
      </header>
      <p className="text-white/50 text-sm">
        Shown only to the administrator while Vite is in development. A
        production build never offers these, whoever is signed in.
      </p>

      <div className="flex items-start justify-between gap-4 pt-4 border-t border-white/10">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-neutral-100">
            Draw the motion wireframe over the webcam preview
          </h3>
          <p className="text-sm text-white/60 mt-1">
            Paints the landmarker&apos;s face mesh (478 vertices joined by the
            library&apos;s own tessellation, contours brighter on top) and the
            body skeleton over the sidebar camera tile, so it is visible that the
            landmarker loaded and where the points land. The mesh is drawn only
            while the tracker is running, which needs &ldquo;Learn how I
            move&rdquo; on and a front-facing webcam.
          </p>
        </div>
        <Switch
          checked={shown}
          onChange={setShown}
          label="Draw the motion wireframe over the webcam preview"
          showLabel
          onLabel="Shown"
          offLabel="Hidden"
          disabled={!MOTION_WIREFRAME_OVERLAY}
        />
      </div>
      {!MOTION_WIREFRAME_OVERLAY && (
        <p className="text-xs text-white/40">
          VITE_MOTION_WIREFRAME_OVERLAY is off for this deployment, so the mesh
          cannot be drawn here whatever this switch says.
        </p>
      )}
      {shown && !motionCaptureEnabled && (
        <p className="text-xs text-amber-200/80">
          &ldquo;Learn how I move&rdquo; is off, so the tracker is not running
          and there is no mesh to draw. Switch it on above.
        </p>
      )}
    </section>
  );
};

export default DeveloperOptionsSection;
