import { useLayoutEffect, useRef } from 'react';
import { registerSharePreviewSlot } from './sharePreviewSlots';

/**
 * A mount point in the sidebar for the webcam and screen tiles.
 *
 * @param {{ name: 'rail' | 'panel', className?: string, isolateClicks?: boolean }} props
 */
const SharePreviewSlot = ({ name, className = '', isolateClicks = false }) => {
  const slotRef = useRef(null);

  useLayoutEffect(() => {
    if (!slotRef.current) return undefined;
    return registerSharePreviewSlot(name, slotRef.current);
  }, [name]);

  return (
    <div
      ref={slotRef}
      data-sidebar-share={name}
      className={className}
      onClick={
        isolateClicks ? (event) => event.stopPropagation() : undefined
      }
    />
  );
};

export default SharePreviewSlot;
