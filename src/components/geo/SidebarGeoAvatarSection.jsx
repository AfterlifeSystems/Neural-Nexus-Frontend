// src/components/geo/SidebarGeoAvatarSection.jsx
//
// The sidebar's "Avatars near you": the switch that starts the position watch,
// the local street map of the pins around the person, and the way to the world
// globe. This is the panel form; the collapsed rail carries the same two
// destinations as icons through AccountMenu.
//
// Picking an avatar on the map shows its card; Talk on the card is what opens
// the conversation, over the live camera when the person is standing there.

import { useNavigate } from 'react-router-dom';
import { Globe, MapPin } from 'lucide-react';

import { useGeoAvatars } from '../../context/GeoAvatarContext';
import ClearMyLocationButton from './ClearMyLocationButton';
import NearbyAvatarsMapPanel from './NearbyAvatarsMapPanel';
import { voiceChatPath } from '../../services/voiceModePreference';

/**
 * @param {Object} props
 * @param {() => void} [props.onNavigate] Called after a navigation, so the sidebar can close.
 */
const SidebarGeoAvatarSection = ({ onNavigate }) => {
  const navigate = useNavigate();
  const {
    canWatch,
    isWatchEnabled,
    setWatchEnabled,
    nearbyAvatars,
    position,
    locationErrorMessage,
    refreshPosition,
    asAnonymousIdentity,
  } = useGeoAvatars();

  // Saying why is better than vanishing: a browser on an insecure origin used
  // to make the whole section disappear, which reads as a missing feature
  // rather than a browser that will not report a position.
  if (!canWatch) {
    return (
      <div className="space-y-2 border-b border-white/10 pb-4">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-white/60">
          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
          Avatars near you
        </h2>
        <p className="px-1 text-xs text-white/50">
          This browser will not say where the device is. Location needs a secure
          (https) connection.
        </p>
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            navigate('/map');
          }}
          className="inline-flex items-center gap-1 px-1 text-xs text-white/50 hover:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
        >
          <Globe className="h-3.5 w-3.5" aria-hidden="true" />
          World map
        </button>
      </div>
    );
  }

  const openAvatar = (entry) => {
    onNavigate?.();
    navigate(
      voiceChatPath(entry.assistant_id, {
        cameraBackground: Boolean(entry.inside_geofence),
      })
    );
  };

  return (
    <div className="space-y-2 border-b border-white/10 pb-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-white/60">
          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
          Avatars near you
        </h2>
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            navigate('/map');
          }}
          className="inline-flex items-center gap-1 text-xs text-white/50 hover:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
        >
          <Globe className="h-3.5 w-3.5" aria-hidden="true" />
          World map
        </button>
      </div>

      <label className="flex items-start gap-2 px-1 text-xs text-white/60">
        <input
          type="checkbox"
          checked={isWatchEnabled}
          onChange={(changeEvent) =>
            setWatchEnabled(changeEvent.target.checked)
          }
          className="mt-0.5 h-3.5 w-3.5 accent-amber-400"
        />
        <span>Notify me when I reach an avatar&rsquo;s place</span>
      </label>

      <ClearMyLocationButton placement="toolbar" />

      <NearbyAvatarsMapPanel
        nearbyAvatars={nearbyAvatars}
        position={position}
        error={locationErrorMessage}
        enabled={isWatchEnabled}
        asAnonymousIdentity={asAnonymousIdentity}
        onRefresh={refreshPosition}
        onOpenAvatar={openAvatar}
      />
    </div>
  );
};

export default SidebarGeoAvatarSection;
