// src/components/geo/showNearbyAvatarToast.jsx
//
// The person has walked up to the place a geo-located avatar stands at. This is
// the in-app half of the notice; the desktop notification in GeoAvatarWatcher
// covers the case where they are looking at another tab.
//
// Talk now opens the avatar in voice mode over the live camera, so the avatar
// appears in the place they are standing in.

import { toast } from 'react-hot-toast';
import { MapPin } from 'lucide-react';

/**
 * @param {Object} parameters
 * @param {Object} parameters.entry The nearby-avatar entry: {assistant_id, name, geo_location}.
 * @param {(entry: Object) => void} parameters.onTalkNow Open the avatar over the camera.
 */
export function showNearbyAvatarToast({ entry, onTalkNow }) {
  const toastId = `geo-nearby:${entry.assistant_id}`;
  const placeName = entry.geo_location?.location_name;

  const talkNow = () => {
    toast.dismiss(toastId);
    onTalkNow?.(entry);
  };

  toast.custom(
    (nearbyToast) => (
      <div
        className={`${
          nearbyToast.visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
        } transition-all duration-200 max-w-md w-full flex pointer-events-auto rounded-lg shadow-lg backdrop-blur-lg bg-[rgba(0,0,0,0.92)] ring-1 ring-white/15`}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={talkNow}
          onKeyDown={(keyboardEvent) => {
            if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
              keyboardEvent.preventDefault();
              talkNow();
            }
          }}
          className="group flex-1 w-0 p-4 cursor-pointer hover:bg-white/5 rounded-l-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
        >
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-neutral-100">
                {entry.name ?? 'An avatar'} is here
              </p>
              <p className="mt-1 text-sm text-white/60">
                {placeName ? `You have reached ${placeName}. ` : 'You have reached this place. '}
                <span className="font-semibold text-neutral-300 underline underline-offset-2 group-hover:text-neutral-100">
                  Talk now
                </span>{' '}
                to see them where you are standing.
              </p>
            </div>
          </div>
        </div>
        <div className="flex border-l border-white/10">
          <button
            type="button"
            onClick={() => toast.dismiss(nearbyToast.id)}
            className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-amber-300 hover:text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
          >
            Close
          </button>
        </div>
      </div>
    ),
    { id: toastId, duration: Infinity }
  );
}

export default showNearbyAvatarToast;
