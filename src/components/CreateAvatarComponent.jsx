import React, { useRef } from 'react';
import { CirclePlus } from 'lucide-react';
import PixelCard from './PixelCard';

/**
 * The gallery's "Create Avatar" card.
 *
 * Fills the box the gallery gives it, so it can stand exactly where the WebGL
 * card for the same entry is drawn. Hovering or focusing the card fills its
 * surface with shimmering off-white and gold pixels.
 */
const CreateAvatarComponent = ({ onCardClick }) => {
  // The gallery scrolls by dragging anywhere, this card included. A drag that
  // starts or ends on the card must not open the create dialog, so a press is
  // only a click when the pointer has barely moved.
  const pointerDownPositionRef = useRef(null);
  const DRAG_TOLERANCE_PIXELS = 6;
  const handleClick = (event) => {
    const pressedAt = pointerDownPositionRef.current;
    pointerDownPositionRef.current = null;
    if (
      pressedAt &&
      Math.hypot(event.clientX - pressedAt.x, event.clientY - pressedAt.y) >
        DRAG_TOLERANCE_PIXELS
    ) {
      return;
    }
    onCardClick({ type: 'create', id: 'create-avatar' });
  };
  return (
    <PixelCard
      variant="gold"
      className="w-full h-full cursor-pointer"
      role="button"
      aria-label="Create Avatar"
      onPointerDown={(event) => {
        pointerDownPositionRef.current = { x: event.clientX, y: event.clientY };
      }}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onCardClick({ type: 'create', id: 'create-avatar' });
        }
      }}
    >
      {/* The circle sits at the exact centre of the card — where the pixel
          shimmer radiates from — and the words hang beneath it, so the two are
          placed independently rather than centred together as one block. */}
      <div className="relative w-full h-full">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-full flex items-center justify-center border border-white/10 bg-black/60">
          <CirclePlus className="w-14 h-14 text-neutral-200" strokeWidth={1.25} />
        </div>
        <div className="absolute inset-x-0 top-[calc(50%+4.5rem)] px-6 text-center">
          <h3 className="text-2xl font-bold text-neutral-200 mb-1">Create Avatar</h3>
          <p className="text-white/60 text-sm">Click to create a new avatar</p>
        </div>
      </div>
    </PixelCard>
  );
};

export default CreateAvatarComponent;
