import React from 'react';
import { User } from 'lucide-react';
import { isValidImageUrl } from './utils'; // Utility function moved to a shared utils file

/**
 * One avatar tile.
 *
 * `iconSource` is passed in rather than read off the avatar record, because an
 * avatar record carries no imagery at all: no listing endpoint returns an icon
 * field. The portrait comes from GET /avatar_reference_image, which the
 * selection screen fetches once per avatar. Reading a non-existent `avatar.icon`
 * is why every tile used to show the placeholder.
 */
const AvatarCardComponent = ({ avatar, iconSource, onCardClick }) => {
  return (
    <div
      className="bg-black/60 backdrop-blur-lg rounded-2xl border border-white/10 p-16 text-center cursor-pointer hover:bg-white/10 transition-all duration-300"
      onClick={() => onCardClick(avatar)}
    >
      <div className="flex justify-center mb-8">
        <div className="w-32 h-32 bg-white/10 rounded-full flex items-center justify-center border-2 border-white/10 hover:border-white/40 transition-all duration-300">
          {iconSource && isValidImageUrl(iconSource) ? (
            <img
              src={iconSource}
              alt={avatar.name}
              className="w-16 h-16 object-contain"
              onError={(e) => {
                console.error('Avatar image load failed:', e.target.src);
                e.target.style.display = 'none';
              }}
            />
          ) : (
            <User className="w-16 h-16 text-neutral-400 opacity-20" />
          )}
        </div>
      </div>
    </div>
  );
};

export default AvatarCardComponent;
