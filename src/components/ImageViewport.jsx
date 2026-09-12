// src/components/ImageViewport.jsx
//
// A framed picture the person can grab, slide, and zoom. The children fill
// the frame (object-fit: contain). Drag moves the part that is showing;
// wheel, pinch, and the + / − buttons zoom.

import { Minus, Plus, RotateCcw } from 'lucide-react';

import { IMAGE_VIEWPORT_MAX_SCALE } from '../services/imageViewport';
import useImageViewport from '../hooks/useImageViewport';

const CONTROL_BUTTON_CLASSES =
  'inline-flex items-center justify-center rounded-md border border-neutral-700 bg-black/60 p-1 text-neutral-200 hover:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:opacity-40';

/**
 * @param {Object} props
 * @param {import('react').ReactNode} props.children The still or clip.
 * @param {string} [props.className] Size and chrome of the frame.
 * @param {string} [props.label] Accessible name for the frame.
 * @param {string|number|null} [props.resetKey] Changing this fits the picture again.
 * @param {string|null} [props.persistKey] Remember the framing across visits.
 * @param {'contain'|'cover'} [props.fit] Cover is the profile-bubble crop.
 * @param {boolean} [props.showControls] Show + / − / fit. On by default.
 * @param {'overlay'|'below'} [props.controlsPlacement]
 */
const ImageViewport = ({
  children,
  className = '',
  label = 'Reference image',
  resetKey = null,
  persistKey = null,
  fit = 'contain',
  showControls = true,
  controlsPlacement = 'overlay',
}) => {
  const {
    frameRef,
    viewport,
    transformStyle,
    coverLayout,
    isGrabbing,
    isZoomed,
    isFramed,
    canPan,
    zoomIn,
    zoomOut,
    reset,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onDoubleClick,
    onKeyDown,
  } = useImageViewport({ resetKey, persistKey, fit });

  const zoomPercent = Math.round(viewport.scale * 100);
  const controls = (
    <div
      className={`flex items-center gap-1 ${
        controlsPlacement === 'overlay' ? 'absolute bottom-2 left-2 z-20' : 'mt-1'
      }`}
    >
      <button
        type="button"
        onClick={zoomOut}
        disabled={!isZoomed}
        className={CONTROL_BUTTON_CLASSES}
        aria-label="Zoom out"
      >
        <Minus className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={zoomIn}
        disabled={viewport.scale >= IMAGE_VIEWPORT_MAX_SCALE}
        className={CONTROL_BUTTON_CLASSES}
        aria-label="Zoom in"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={reset}
        disabled={!isFramed}
        className={CONTROL_BUTTON_CLASSES}
        aria-label="Fit the whole picture"
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <span className="rounded-md border border-neutral-700 bg-black/60 px-1.5 py-0.5 text-[10px] tabular-nums text-neutral-200">
        {zoomPercent}%
      </span>
    </div>
  );

  const frame = (
    <div
      ref={frameRef}
      data-image-viewport
      role="group"
      aria-label={label}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
      className={`relative touch-none select-none focus:outline-none focus:ring-2 focus:ring-amber-400/50 ${
        isGrabbing ? 'cursor-grabbing' : canPan || isZoomed ? 'cursor-grab' : 'cursor-zoom-in'
      } ${className}`}
    >
      <div className="absolute inset-0 overflow-hidden rounded-[inherit]">
        {fit === 'cover' && coverLayout.width > 0 && coverLayout.height > 0 ? (
          <div
            className="absolute"
            style={{
              width: coverLayout.width,
              height: coverLayout.height,
              left: coverLayout.left,
              top: coverLayout.top,
            }}
          >
            {children}
          </div>
        ) : (
          <div className="h-full w-full will-change-transform" style={transformStyle}>
            {children}
          </div>
        )}
      </div>
      {showControls && controlsPlacement === 'overlay' ? controls : null}
    </div>
  );

  if (controlsPlacement === 'below') {
    return (
      <div className="flex w-32 flex-col items-center">
        {frame}
        {showControls ? controls : null}
      </div>
    );
  }
  return frame;
};

export default ImageViewport;
