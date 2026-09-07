// src/components/geo/AvatarPlaceCard.jsx
//
// The Avatar Settings card that pins an avatar to a real-world place, moves the
// pin, or removes it. A memorial, a grave marker or a shopfront is usually
// chosen after the avatar exists, and a place can change, so this is the home
// of the pin rather than the create dialog.
//
// Being pinned never restricts who may talk to the avatar. It puts the avatar
// on the world map, and it lets the avatar greet someone who has walked up to
// the place with the live camera behind them.

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { MapPin, Trash2 } from 'lucide-react';

import {
  DEFAULT_GEOFENCE_RADIUS_METERS,
  isValidCoordinate,
  pinOf,
} from '../../services/avatarProximity';
import { modifyAvatar } from '../../services/avatarService';
import AvatarLocationPicker from './AvatarLocationPicker';

const EMPTY_PIN = {
  latitude: undefined,
  longitude: undefined,
  locationName: '',
  geofenceRadiusMeters: DEFAULT_GEOFENCE_RADIUS_METERS,
};

/**
 * The pin as the picker edits it, from the record the API returned.
 *
 * @param {Object|null} avatar
 * @returns {Object}
 */
function editablePinOf(avatar) {
  const pin = pinOf(avatar);
  if (!pin) return EMPTY_PIN;
  return {
    latitude: Number(pin.latitude),
    longitude: Number(pin.longitude),
    locationName: pin.location_name ?? '',
    geofenceRadiusMeters:
      pin.geofence_radius_meters ?? DEFAULT_GEOFENCE_RADIUS_METERS,
  };
}

/**
 * @param {Object} props
 * @param {string} props.assistantId The avatar being edited.
 * @param {Object|null} props.activeAvatar The avatar record.
 * @param {(changedFields: Object) => void} props.onAvatarChanged Update the local copy after a save.
 */
const AvatarPlaceCard = ({ assistantId, activeAvatar, onAvatarChanged }) => {
  const savedPin = pinOf(activeAvatar);
  const [draftPin, setDraftPin] = useState(() => editablePinOf(activeAvatar));
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // A different avatar, or a pin changed elsewhere, replaces the draft.
  useEffect(() => {
    setDraftPin(editablePinOf(activeAvatar));
    setIsEditing(false);
  }, [activeAvatar]);

  const savePin = async () => {
    if (!isValidCoordinate(draftPin.latitude, draftPin.longitude)) {
      toast.error('Place this avatar on the map first.');
      return;
    }
    setIsSaving(true);
    try {
      await modifyAvatar({ assistantId, geoLocation: draftPin });
      onAvatarChanged?.({
        geo_location: {
          latitude: draftPin.latitude,
          longitude: draftPin.longitude,
          location_name: draftPin.locationName?.trim() || null,
          geofence_radius_meters: draftPin.geofenceRadiusMeters,
        },
      });
      setIsEditing(false);
      toast.success(
        savedPin ? 'This avatar has moved.' : 'This avatar now stands here.'
      );
    } catch (saveError) {
      toast.error(saveError.message);
    } finally {
      setIsSaving(false);
    }
  };

  const clearPin = async () => {
    setIsSaving(true);
    try {
      await modifyAvatar({ assistantId, clearGeoLocation: true });
      onAvatarChanged?.({ geo_location: null });
      setDraftPin(EMPTY_PIN);
      setIsEditing(false);
      toast.success('This avatar no longer stands anywhere.');
    } catch (clearError) {
      toast.error(clearError.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-black/60 p-6 backdrop-blur-lg">
      <h3 className="mb-1 flex items-center gap-2 text-lg font-semibold text-neutral-200">
        <MapPin size={20} className="text-amber-300" aria-hidden="true" />
        Real-world location
      </h3>
      <p className="mb-4 text-sm text-white/50">
        Pin this avatar to a place and it appears on the world map. Anyone can
        still talk to it from anywhere; someone standing at the place sees it
        over their camera, in the place itself.
      </p>

      {savedPin && !isEditing ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-white/10 bg-black/40 px-3 py-2">
            <p className="text-sm text-neutral-200">
              {savedPin.location_name ?? 'An unnamed place'}
            </p>
            <p className="text-xs text-white/40">
              {Number(savedPin.latitude).toFixed(5)},{' '}
              {Number(savedPin.longitude).toFixed(5)} · visitors count as here
              within {savedPin.geofence_radius_meters ?? DEFAULT_GEOFENCE_RADIUS_METERS} m
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              disabled={isSaving}
              className="rounded-md border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-neutral-200 hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:opacity-60"
            >
              Move this avatar
            </button>
            <button
              type="button"
              onClick={clearPin}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-white/60 hover:bg-black/60 hover:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:opacity-60"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Remove the pin
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <AvatarLocationPicker value={draftPin} onChange={setDraftPin} />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={savePin}
              disabled={isSaving}
              className="rounded-md border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-neutral-200 hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:opacity-60"
            >
              {isSaving ? 'Saving…' : savedPin ? 'Save the new place' : 'Place this avatar'}
            </button>
            {savedPin && (
              <button
                type="button"
                onClick={() => {
                  setDraftPin(editablePinOf(activeAvatar));
                  setIsEditing(false);
                }}
                disabled={isSaving}
                className="rounded-md border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-white/60 hover:bg-black/60 hover:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:opacity-60"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AvatarPlaceCard;
