// src/components/geo/ClearMyLocationButton.jsx
//
// Stops sharing this device's place. Lives on the world map, in the sidebar,
// and on the personal avatar's Real-world location card.

import { Trash2 } from 'lucide-react';

import { useGeoAvatars } from '../../context/GeoAvatarContext';

/**
 * @param {Object} [props]
 * @param {'toolbar' | 'settings'} [props.placement]
 */
const ClearMyLocationButton = ({ placement = 'toolbar' }) => {
  const { isWatchEnabled, setWatchEnabled, position } = useGeoAvatars();
  const isSharing = isWatchEnabled || Boolean(position);

  if (!isSharing) return null;

  const isSettings = placement === 'settings';

  return (
    <button
      type="button"
      onClick={() => setWatchEnabled(false)}
      className={`inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-black/40 text-white/70 hover:bg-black/60 hover:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50 ${
        isSettings ? 'px-3 py-1.5 text-sm' : 'px-3 py-1.5 text-xs'
      }`}
    >
      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
      Clear my location
    </button>
  );
};

export default ClearMyLocationButton;
