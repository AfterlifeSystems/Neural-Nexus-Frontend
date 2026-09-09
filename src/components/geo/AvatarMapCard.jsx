// src/components/geo/AvatarMapCard.jsx
//
// The avatar the person has picked out on a map: its portrait, its name and
// place, what it is about, and the one thing to do next — talk to it.
//
// Choosing a pin is a question ("who is this?") before it is a decision to
// open a conversation, so a pick shows this card rather than navigating. The
// sidebar's minimap and the world map both use it; the minimap in its compact
// form.

import { X } from 'lucide-react';

import useAvatarReferenceImage from '../../hooks/useAvatarReferenceImage';
import { avatarDescriptionOf, mapMarkOf } from '../../services/avatarMapMark';
import { describeDistance, pinOf } from '../../services/avatarProximity';

/**
 * @param {Object} props
 * @param {Object} props.avatar The avatar record or nearby entry:
 *   {assistant_id, name, description, geo_location, distance_meters, inside_geofence}.
 * @param {boolean} [props.asAnonymousIdentity] Fetch the portrait as the visitor.
 * @param {boolean} [props.isOwned] Draw the mark in the owner's amber.
 * @param {boolean} [props.compact] The sidebar form.
 * @param {string} [props.footnote] A small line under the description (coordinates, radius).
 * @param {() => void} props.onTalk Open the avatar.
 * @param {() => void} [props.onClose] Put the card away.
 */
const AvatarMapCard = ({
  avatar,
  asAnonymousIdentity = false,
  isOwned = false,
  compact = false,
  footnote = '',
  onTalk,
  onClose,
}) => {
  const assistantId = avatar?.assistant_id ?? avatar?.avatar_id ?? null;
  const portrait = useAvatarReferenceImage(assistantId, {
    asAnonymousIdentity,
  });
  const name = avatar?.name ?? 'Avatar';
  const pin = pinOf(avatar);
  const description = avatarDescriptionOf(avatar);
  const whereabouts = avatar?.inside_geofence
    ? 'you are here'
    : describeDistance(avatar?.distance_meters);

  const portraitSize = compact ? 'h-12 w-12' : 'h-16 w-16';

  return (
    <section
      aria-label={`${name} on the map`}
      className={`relative flex items-start gap-3 rounded-xl border border-white/10 bg-black/60 backdrop-blur-lg ${
        compact ? 'px-3 py-2.5' : 'px-4 py-3'
      }`}
    >
      <span
        className={`inline-flex ${portraitSize} shrink-0 items-center justify-center overflow-hidden rounded-full border bg-black/60 text-xs ${
          isOwned
            ? 'border-amber-300/50 text-amber-200'
            : 'border-white/20 text-neutral-200'
        }`}
        aria-hidden={portrait ? undefined : 'true'}
      >
        {portrait ? (
          <img
            src={portrait}
            alt={`${name}'s portrait`}
            className="h-full w-full object-cover"
          />
        ) : (
          mapMarkOf(avatar).initials
        )}
      </span>

      <div className="min-w-0 flex-1 space-y-1">
        <p
          className={`font-medium text-neutral-100 ${compact ? 'text-xs' : 'text-sm'} ${
            onClose ? 'pr-6' : ''
          }`}
        >
          {name}
          {pin?.location_name ? (
            <span className="text-amber-300"> · {pin.location_name}</span>
          ) : null}
        </p>
        {description ? (
          <p
            className={`whitespace-pre-line leading-relaxed text-white/70 ${
              compact ? 'text-xs line-clamp-4' : 'text-sm'
            }`}
          >
            {description}
          </p>
        ) : (
          <p className="text-xs text-white/40">
            This avatar has no description yet.
          </p>
        )}
        {whereabouts ? (
          <p className="text-[11px] text-white/40">{whereabouts}</p>
        ) : null}
        {footnote ? (
          <p className="font-mono text-[10px] text-white/40">{footnote}</p>
        ) : null}
        <div className="pt-1">
          <button
            type="button"
            onClick={onTalk}
            className="rounded-md border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-neutral-200 hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
          >
            Talk
          </button>
        </div>
      </div>

      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          title="Close"
          aria-label={`Close ${name}`}
          className="absolute right-2 top-2 rounded-md p-1 text-white/50 hover:bg-white/10 hover:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </section>
  );
};

export default AvatarMapCard;
