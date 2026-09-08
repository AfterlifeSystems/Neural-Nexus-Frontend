// src/components/geo/AvatarRosterDropdown.jsx
//
// A persistent, collapsible list of pinned avatars. The globe count and a
// numbered place both open one of these so a stack of overlapping pins stays
// a readable number, then a scrollable list of names.

import { ChevronDown, ChevronUp } from 'lucide-react';

import { mapMarkOf } from '../../services/avatarMapMark';
import {
  avatarIdOf,
  formatCoordinate,
  mapKeyOf,
  pinOf,
} from '../../services/avatarProximity';

function sortAvatarsByName(avatars) {
  return [...(avatars ?? [])].sort((left, right) => {
    const byName = String(left?.name ?? '').localeCompare(
      String(right?.name ?? ''),
      undefined,
      { sensitivity: 'base' }
    );
    if (byName !== 0) return byName;
    return String(avatarIdOf(left) ?? '').localeCompare(
      String(avatarIdOf(right) ?? '')
    );
  });
}

/**
 * @param {Object} props
 * @param {React.ReactNode} [props.icon]
 * @param {string} props.label
 * @param {Array<Object>} props.avatars
 * @param {string|null} [props.selectedAssistantId]
 * @param {boolean} props.isOpen
 * @param {() => void} props.onToggle
 * @param {(place: Object) => void} props.onChoose
 * @param {Set<string>} [props.ownedAssistantIds]
 * @param {string} [props.worldActionLabel]
 * @param {() => void} [props.onShowWorld]
 */
const AvatarRosterDropdown = ({
  icon,
  label,
  avatars,
  selectedAssistantId,
  isOpen,
  onToggle,
  onChoose,
  ownedAssistantIds,
  worldActionLabel,
  onShowWorld,
}) => {
  if (!avatars?.length) return null;
  const rows = sortAvatarsByName(avatars);

  return (
    <div className="w-[min(24rem,calc(100vw-3rem))] rounded-lg border border-white/10 bg-black/80 backdrop-blur-lg">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs text-neutral-200 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
      >
        <span className="inline-flex min-w-0 items-center gap-2">
          {icon}
          <span className="whitespace-normal break-words">{label}</span>
        </span>
        {isOpen ? (
          <ChevronUp className="h-3.5 w-3.5 shrink-0 text-white/50" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/50" aria-hidden="true" />
        )}
      </button>
      {isOpen ? (
        <ul className="max-h-56 overflow-y-auto border-t border-white/10 px-1.5 py-1.5">
          {onShowWorld ? (
            <li>
              <button
                type="button"
                onClick={onShowWorld}
                className="mb-1 w-full rounded-md px-2 py-1.5 text-left text-xs text-white/50 hover:bg-white/5 hover:text-neutral-200"
              >
                {worldActionLabel || 'All avatars in the world'}
              </button>
            </li>
          ) : null}
          {rows.map((avatar) => {
            const assistantId = avatarIdOf(avatar);
            const markerKey = mapKeyOf(avatar);
            const pin = pinOf(avatar);
            if (!markerKey || !pin) return null;
            const mark = mapMarkOf(avatar);
            const isSelected =
              selectedAssistantId === assistantId ||
              selectedAssistantId === markerKey;
            const isOwned = assistantId
              ? ownedAssistantIds?.has(assistantId)
              : false;
            return (
              <li key={markerKey}>
                <button
                  type="button"
                  onClick={() =>
                    onChoose({
                      latitude: Number(pin.latitude),
                      longitude: Number(pin.longitude),
                      assistantId: assistantId ?? markerKey,
                      source: 'list',
                      avatars,
                    })
                  }
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                    isSelected
                      ? 'bg-amber-300/10 text-amber-200'
                      : 'text-neutral-200 hover:bg-white/5'
                  }`}
                >
                  <span
                    className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border bg-black/60 text-[10px] ${
                      isOwned
                        ? 'border-amber-300/50 text-amber-200'
                        : 'border-white/20 text-neutral-200'
                    }`}
                    aria-hidden="true"
                  >
                    {mark.initials}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {avatar.name ?? 'Avatar'}
                  </span>
                  <span className="shrink-0 text-[10px] text-white/40">
                    {pin.location_name ||
                      `${formatCoordinate(pin.latitude)}, ${formatCoordinate(pin.longitude)}`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
};

export default AvatarRosterDropdown;
