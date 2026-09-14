import React, { useRef } from 'react';
import { CirclePlus } from 'lucide-react';
import PixelCard from './PixelCard';

/**
 * The gallery's "Create Avatar" card.
 *
 * Fills the box the gallery gives it, so it can stand exactly where the WebGL
 * card for the same entry is drawn. Hovering or focusing the card fills its
 * surface with shimmering off-white and gold pixels. On a phone there is no
 * hover, so the same fill plays while this card is the one in front.
 */
const CreateAvatarComponent = ({ onCardClick, active = false }) => {
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
      active={active}
      className="@container w-full h-full cursor-pointer"
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
      {/* The plus is locked to PixelCard's explosion origin. The title
          sits on the bottom edge so it cannot pull the plus off that
          origin. Sizes are fractions of the card, not fixed rem. */}
      <div className="relative w-full h-full">
        <div
          data-create-avatar-plus
          className="absolute flex w-[34%] aspect-square items-center justify-center rounded-full border border-white/10 bg-black/60"
          style={{
            left: 'var(--pixel-card-origin-x)',
            top: 'var(--pixel-card-origin-y)',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <CirclePlus
            className="block h-1/2 w-1/2 text-neutral-200"
            strokeWidth={1.25}
          />
        </div>
        <div className="absolute inset-x-0 bottom-[7%] px-[6%] text-center">
          <h3 className="text-[length:clamp(0.9rem,8cqi,1.5rem)] font-bold text-neutral-200 mb-0.5 leading-tight">
            Create Avatar
          </h3>
          <p className="text-white/60 text-[length:clamp(0.65rem,4.6cqi,0.875rem)] leading-snug">
            Click to create a new avatar
          </p>
        </div>
      </div>
    </PixelCard>
  );
};

export default CreateAvatarComponent;
