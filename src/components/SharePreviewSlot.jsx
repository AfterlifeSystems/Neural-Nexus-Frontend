import { useLayoutEffect, useRef } from 'react';
import { registerSharePreviewSlot } from './sharePreviewSlots';

/**
 * A mount point in the sidebar for the webcam and screen tiles.
 *
 * Clicks on the collapsed rail well are left to bubble: the rail opens the
 * sidebar, and the footage tiles are how a person asks to see them larger.
 *
 * @param {{ name: 'rail' | 'panel', className?: string }} props
 */
const SharePreviewSlot = ({ name, className = '' }) => {
  const slotRef = useRef(null);

  useLayoutEffect(() => {
    if (!slotRef.current) return undefined;
    return registerSharePreviewSlot(name, slotRef.current);
  }, [name]);

  return (
    <div ref={slotRef} data-sidebar-share={name} className={className} />
  );
};

export default SharePreviewSlot;
