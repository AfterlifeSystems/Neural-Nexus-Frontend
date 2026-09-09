// src/components/geo/WorldMapScreen.jsx
//
// The world map screen keeps the globe and the street map on screen together.
// Clicking a globe pin flies the globe there and zooms the leaflet map to the
// same coordinates. A pin created here can be dragged or edited on the street
// map without putting the globe away.

import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  ChevronDown,
  ChevronUp,
  Compass,
  Crosshair,
  Globe,
  Loader2,
  MapPin,
  Search,
} from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { useGeoAvatars } from '../../context/GeoAvatarContext';
import { avatarMatchesSearch, mapMarkOf } from '../../services/avatarMapMark';
import {
  DEFAULT_GEOFENCE_RADIUS_METERS,
  avatarIdOf,
  avatarsAtSamePlace,
  avatarsInFocusGroup,
  avatarsWithinMeters,
  groupIdsForFocus,
  mapKeyOf,
  describeDistance,
  describeGeofenceRadius,
  formatCoordinate,
  isValidCoordinate,
  mergePinnedAvatars,
  pinOf,
  withPin,
  withoutPin,
} from '../../services/avatarProximity';
import {
  listGeoAvatars,
  listUserAvatars,
  modifyAvatar,
} from '../../services/avatarService';
import { isAvatarOwnedByUser } from '../utils';
import { voiceChatPath } from '../../services/voiceModePreference';
import AvatarMapCard from './AvatarMapCard';
import AvatarRosterDropdown from './AvatarRosterDropdown';
import ClearMyLocationButton from './ClearMyLocationButton';
import WorldStreetMap from './WorldStreetMap';

const WorldAvatarGlobe = lazy(() => import('./WorldAvatarGlobe'));

const STREET_NEIGHBORHOOD_METERS = 800;
const GEO_HYDRATE_BATCH = 6;

/**
 * One row of the search dropdown: initials, name, place.
 */
function SearchResultRow({
  avatar,
  isOwned,
  isSelected,
  isActive,
  optionId,
  onChoose,
  onHover,
}) {
  const pin = pinOf(avatar);
  const markerKey = mapKeyOf(avatar);
  if (!pin || !markerKey) return null;
  const mark = mapMarkOf(avatar);
  return (
    <li id={optionId} role="option" aria-selected={isSelected}>
      <button
        type="button"
        tabIndex={-1}
        onMouseDown={(event) => event.preventDefault()}
        onMouseEnter={onHover}
        onClick={() => onChoose(avatar)}
        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
          isSelected
            ? 'bg-amber-300/10 text-amber-200'
            : isActive
              ? 'bg-white/5 text-neutral-100'
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
        <span className="min-w-0 flex-1 truncate">{avatar.name ?? 'Avatar'}</span>
        <span className="shrink-0 text-[10px] text-white/40">
          {pin.location_name ||
            `${formatCoordinate(pin.latitude)}, ${formatCoordinate(pin.longitude)}`}
        </span>
      </button>
    </li>
  );
}

const WorldMapScreen = () => {
  const navigate = useNavigate();
  const { user, userAvatars, setUserAvatars, setActiveAvatar, activeAvatar } =
    useAuth();
  const {
    canWatch,
    isWatchEnabled,
    setWatchEnabled,
    nearbyAvatars,
    position,
    locationErrorMessage,
    refreshPosition,
    isStandingAt,
    asAnonymousIdentity,
  } = useGeoAvatars();

  const [publicAvatars, setPublicAvatars] = useState([]);
  const [isLoadingPins, setIsLoadingPins] = useState(true);
  const [pinsError, setPinsError] = useState('');
  const [mapFocus, setMapFocus] = useState(null);
  const [savingAssistantId, setSavingAssistantId] = useState('');
  const [avatarSearch, setAvatarSearch] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [isNearbyOpen, setIsNearbyOpen] = useState(false);
  const [isMinimapOpen, setIsMinimapOpen] = useState(true);
  const [worldViewRevision, setWorldViewRevision] = useState(0);
  const searchBoxRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const [pinned, ownedList] = await Promise.all([
          listGeoAvatars(),
          user
            ? listUserAvatars().catch(() => userAvatars ?? [])
            : Promise.resolve(userAvatars ?? []),
        ]);
        if (!isMounted) return;

        let owned = (ownedList ?? []).map((avatar) => {
          if (pinOf(avatar)) return avatar;
          const id = avatarIdOf(avatar);
          const prior = (userAvatars ?? []).find(
            (candidate) => avatarIdOf(candidate) === id
          );
          const priorPin = pinOf(prior);
          return priorPin ? withPin(avatar, priorPin) : avatar;
        });

        const missingIds = owned
          .filter((avatar) => avatarIdOf(avatar) && !pinOf(avatar))
          .map((avatar) => avatarIdOf(avatar));
        const extras = [];
        for (let index = 0; index < missingIds.length; index += GEO_HYDRATE_BATCH) {
          const batch = missingIds.slice(index, index + GEO_HYDRATE_BATCH);
          const results = await Promise.all(
            batch.map((assistantId) =>
              listGeoAvatars({ assistantId }).catch(() => [])
            )
          );
          extras.push(...results.flat());
        }
        if (extras.length > 0) {
          owned = owned.map((avatar) => {
            if (pinOf(avatar)) return avatar;
            const match = extras.find(
              (hit) => avatarIdOf(hit) === avatarIdOf(avatar)
            );
            const pin = pinOf(match);
            return pin ? withPin(avatar, pin) : avatar;
          });
        }

        if (isMounted) {
          if (user) setUserAvatars(owned);
          setPublicAvatars(mergePinnedAvatars(pinned, extras));
          setPinsError('');
        }
      } catch {
        if (isMounted) {
          setPinsError(
            'The pinned avatars could not be loaded. Try again shortly.'
          );
        }
      } finally {
        if (isMounted) setIsLoadingPins(false);
      }
    })();
    return () => {
      isMounted = false;
    };
    // Load once for this visit. userAvatars is refreshed from the API here so
    // a private pin (Thomas Woods) is not dropped when only public geo loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const avatars = useMemo(
    () => mergePinnedAvatars(publicAvatars, userAvatars),
    [publicAvatars, userAvatars]
  );

  const ownedAssistantIds = useMemo(() => {
    const ids = new Set();
    for (const avatar of userAvatars ?? []) {
      const id = avatarIdOf(avatar);
      if (id && isAvatarOwnedByUser(avatar, user)) ids.add(id);
    }
    return ids;
  }, [user, userAvatars]);

  const focusPlace = useCallback((place) => {
    if (!isValidCoordinate(place?.latitude, place?.longitude)) return;
    const fromGroup = place.avatars?.length
      ? avatarIdOf(place.avatars[0])
      : null;
    setMapFocus((previous) => {
      const assistantId =
        place.assistantId ??
        fromGroup ??
        (place.preserveAssistant ? previous?.assistantId ?? null : null);
      const keepGroup =
        place.preserveGroup === true ||
        place.preserveAssistant === true ||
        place.source === 'list' ||
        place.source === 'street';
      const groupAvatars = place.avatars?.length
        ? place.avatars
        : keepGroup
          ? previous?.groupAvatars ?? []
          : [];
      return {
        latitude: Number(place.latitude),
        longitude: Number(place.longitude),
        assistantId,
        groupAvatars,
        groupIds: groupAvatars.length
          ? groupAvatars.map((avatar) => avatarIdOf(avatar)).filter(Boolean)
          : groupIdsForFocus({ ...place, assistantId, preserveGroup: keepGroup }, previous),
        source: place.source ?? 'globe',
        revision: (previous?.revision ?? 0) + 1,
      };
    });
    if (place.source !== 'street') {
      setIsMinimapOpen(true);
    }
  }, []);

  useEffect(() => {
    if (mapFocus) return;
    if (position) {
      setMapFocus({
        latitude: position.latitude,
        longitude: position.longitude,
        assistantId: null,
        source: 'device',
      });
      return;
    }
    const firstPin = pinOf(avatars[0]);
    if (!firstPin) return;
    setMapFocus({
      latitude: Number(firstPin.latitude),
      longitude: Number(firstPin.longitude),
      assistantId: avatarIdOf(avatars[0]),
      source: 'seed',
    });
  }, [avatars, mapFocus, position]);

  const openAvatar = (assistantId) =>
    navigate(
      voiceChatPath(assistantId, {
        cameraBackground: isStandingAt(assistantId),
      })
    );

  const applyPinLocally = useCallback(
    (assistantId, pin) => {
      const update = (candidate) =>
        avatarIdOf(candidate) === assistantId
          ? pin
            ? withPin(candidate, pin)
            : withoutPin(candidate)
          : candidate;
      setUserAvatars((previous) => (previous ?? []).map(update));
      if (avatarIdOf(activeAvatar) === assistantId) {
        setActiveAvatar(update(activeAvatar));
      }
      if (!pin) {
        setPublicAvatars((previous) =>
          (previous ?? []).filter(
            (candidate) => avatarIdOf(candidate) !== assistantId
          )
        );
        return;
      }
      setPublicAvatars((previous) => {
        const next = (previous ?? []).map(update);
        if (next.some((candidate) => avatarIdOf(candidate) === assistantId)) {
          return next;
        }
        return previous;
      });
    },
    [activeAvatar, setActiveAvatar, setUserAvatars]
  );

  const saveAvatarPin = useCallback(
    async (avatar, draft) => {
      const assistantId = avatarIdOf(avatar);
      if (!assistantId || !isValidCoordinate(draft.latitude, draft.longitude)) {
        toast.error('Place this avatar on the map first.');
        return;
      }
      setSavingAssistantId(assistantId);
      try {
        await modifyAvatar({
          assistantId,
          geoLocation: {
            latitude: draft.latitude,
            longitude: draft.longitude,
            locationName: draft.locationName,
            geofenceRadiusMeters:
              draft.geofenceRadiusMeters ?? DEFAULT_GEOFENCE_RADIUS_METERS,
          },
        });
        const saved = {
          latitude: draft.latitude,
          longitude: draft.longitude,
          location_name: (draft.locationName ?? '').trim() || null,
          geofence_radius_meters:
            draft.geofenceRadiusMeters ?? DEFAULT_GEOFENCE_RADIUS_METERS,
        };
        applyPinLocally(assistantId, saved);
        focusPlace({
          ...saved,
          assistantId,
          source: 'save',
        });
        toast.success('This avatar now stands here.');
      } catch (saveError) {
        toast.error(saveError.message);
      } finally {
        setSavingAssistantId('');
      }
    },
    [applyPinLocally, focusPlace]
  );

  const removeAvatarPin = useCallback(
    async (avatar) => {
      const assistantId = avatarIdOf(avatar);
      if (!assistantId) return;
      setSavingAssistantId(assistantId);
      try {
        await modifyAvatar({ assistantId, clearGeoLocation: true });
        applyPinLocally(assistantId, null);
        toast.success('This avatar no longer stands anywhere.');
      } catch (clearError) {
        toast.error(clearError.message);
      } finally {
        setSavingAssistantId('');
      }
    },
    [applyPinLocally]
  );

  const isLocating = isWatchEnabled && !position && !locationErrorMessage;

  const searchResults = useMemo(() => {
    const query = avatarSearch.trim();
    if (!query) return [];
    return avatars
      .filter((avatar) => avatarMatchesSearch(avatar, query, pinOf(avatar)))
      .sort((left, right) =>
        String(left?.name ?? '').localeCompare(String(right?.name ?? ''), undefined, {
          sensitivity: 'base',
        })
      );
  }, [avatarSearch, avatars]);

  useEffect(() => {
    setActiveSearchIndex(0);
  }, [avatarSearch]);

  const chooseSearchResult = useCallback(
    (avatar) => {
      const pin = pinOf(avatar);
      const markerKey = mapKeyOf(avatar);
      if (!pin || !markerKey) return;
      focusPlace({
        latitude: Number(pin.latitude),
        longitude: Number(pin.longitude),
        assistantId: avatarIdOf(avatar) ?? markerKey,
        source: 'search',
      });
      setAvatarSearch(avatar.name ?? '');
      setIsSearchOpen(false);
    },
    [focusPlace]
  );

  const onSearchKeyDown = useCallback(
    (event) => {
      if (event.key === 'Escape') {
        setIsSearchOpen(false);
        return;
      }
      if (!searchResults.length) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setIsSearchOpen(true);
        setActiveSearchIndex((index) => (index + 1) % searchResults.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setIsSearchOpen(true);
        setActiveSearchIndex(
          (index) => (index - 1 + searchResults.length) % searchResults.length
        );
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const chosen = searchResults[activeSearchIndex] ?? searchResults[0];
        if (chosen) chooseSearchResult(chosen);
      }
    },
    [activeSearchIndex, chooseSearchResult, searchResults]
  );

  const nearbyPinnedAvatars = useMemo(
    () =>
      nearbyAvatars
        .map((entry) => {
          const known = avatars.find(
            (avatar) => avatarIdOf(avatar) === entry.assistant_id
          );
          return known ?? entry;
        })
        .filter((entry) => pinOf(entry)),
    [avatars, nearbyAvatars]
  );

  const listedAvatars = useMemo(() => {
    const stored = (mapFocus?.groupAvatars ?? []).filter(Boolean);
    if (stored.length > 1) return stored;
    const fromIds = avatarsInFocusGroup(avatars, mapFocus?.groupIds);
    if (fromIds.length > 1) return fromIds;
    if (mapFocus) {
      const here = avatarsAtSamePlace(
        avatars,
        mapFocus.latitude,
        mapFocus.longitude
      );
      if (here.length > 1) return here;
      const nearby = avatarsWithinMeters(
        avatars,
        mapFocus.latitude,
        mapFocus.longitude,
        STREET_NEIGHBORHOOD_METERS
      );
      if (nearby.length > 1) return nearby;
    }
    if (stored.length) return stored;
    return fromIds;
  }, [avatars, mapFocus]);

  const selectedAvatar = useMemo(
    () =>
      avatars.find(
        (avatar) =>
          avatarIdOf(avatar) === mapFocus?.assistantId ||
          mapKeyOf(avatar) === mapFocus?.assistantId
      ) ?? null,
    [avatars, mapFocus]
  );
  const selectedPin = pinOf(selectedAvatar);
  const showSearchList =
    isSearchOpen && avatarSearch.trim().length > 0;

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-3 p-4">
      <header>
        <h1 className="text-lg font-semibold text-neutral-100">
          Avatars in the world
        </h1>
        <p className="text-sm text-white/50">
          One map: the globe is the world, the street inset is the same place
          close up. Click the globe or a pin and the inset follows; drag a pin
          on the street map and the globe follows. Reset world view, beneath
          the map, pulls the globe back to the whole Earth. Distances are
          metres or miles. The live camera opens only when you are standing at the place.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/60 px-4 py-3 backdrop-blur-lg">
        {canWatch ? (
          <>
            <button
              type="button"
              onClick={() => {
                if (isWatchEnabled) {
                  refreshPosition();
                  if (position) {
                    focusPlace({
                      latitude: position.latitude,
                      longitude: position.longitude,
                      source: 'device',
                    });
                  }
                  return;
                }
                setWatchEnabled(true);
              }}
              className="inline-flex items-center gap-2 rounded-md border border-amber-300/40 px-3 py-1.5 text-sm text-amber-200 transition-colors hover:bg-amber-300/10 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
            >
              {isLocating ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Crosshair className="h-4 w-4" aria-hidden="true" />
              )}
              {isWatchEnabled ? 'Update my position' : 'Find avatars near me'}
            </button>

            <ClearMyLocationButton placement="toolbar" />

            {isWatchEnabled && (
              <label className="inline-flex items-center gap-2 text-xs text-white/60">
                <input
                  type="checkbox"
                  checked={isWatchEnabled}
                  onChange={(changeEvent) =>
                    setWatchEnabled(changeEvent.target.checked)
                  }
                  className="h-3.5 w-3.5 accent-amber-400"
                />
                Keep watching and notify me when I reach a place
              </label>
            )}

            {position && (
              <span className="inline-flex items-center gap-1.5 text-xs text-white/50">
                <Compass className="h-3.5 w-3.5" aria-hidden="true" />
                {formatCoordinate(position.latitude)},{' '}
                {formatCoordinate(position.longitude)}
                {position.accuracyMeters
                  ? ` · ±${describeDistance(position.accuracyMeters)}`
                  : ''}
              </span>
            )}

            {isWatchEnabled && !locationErrorMessage && (
              <span className="text-xs text-white/50">
                {nearbyAvatars.length === 0
                  ? position
                    ? 'No avatars stand near you yet.'
                    : 'Waiting for this device to say where it is…'
                  : `${nearbyAvatars.length} near you`}
              </span>
            )}
          </>
        ) : (
          <p className="text-xs text-white/50">
            This browser will not say where the device is, so avatars near you
            cannot be found. Location needs a secure (https) connection.
          </p>
        )}

        {locationErrorMessage && (
          <p className="text-xs text-red-300">{locationErrorMessage}</p>
        )}
      </div>

      {avatars.length > 0 && (
        <div className="flex flex-col gap-3 md:flex-row md:items-start">
          <div
            ref={searchBoxRef}
            className="relative z-30 w-full md:max-w-md"
            onBlur={(event) => {
              if (!searchBoxRef.current?.contains(event.relatedTarget)) {
                setIsSearchOpen(false);
              }
            }}
          >
            <label className="relative block">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
                aria-hidden="true"
              />
              <input
                type="search"
                role="combobox"
                aria-expanded={showSearchList}
                aria-controls="world-avatar-search-list"
                aria-activedescendant={
                  showSearchList && searchResults[activeSearchIndex]
                    ? `world-avatar-option-${activeSearchIndex}`
                    : undefined
                }
                aria-autocomplete="list"
                value={avatarSearch}
                onChange={(event) => {
                  setAvatarSearch(event.target.value);
                  setIsSearchOpen(true);
                }}
                onFocus={() => setIsSearchOpen(true)}
                onKeyDown={onSearchKeyDown}
                placeholder={`Search ${avatars.length} avatars by name or place…`}
                aria-label="Search avatars in the world"
                className="w-full rounded-lg border border-white/10 bg-black/50 py-2 pl-9 pr-3 text-sm text-neutral-200 placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              />
            </label>
            {showSearchList ? (
              <div className="absolute left-0 right-0 top-full mt-1 rounded-lg border border-white/10 bg-black/80 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-lg">
                {searchResults.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-white/40">
                    No avatars match that search.
                  </p>
                ) : (
                  <ul
                    id="world-avatar-search-list"
                    role="listbox"
                    className="max-h-64 overflow-y-auto px-1.5 py-1.5"
                  >
                    {searchResults.map((avatar, index) => (
                      <SearchResultRow
                        key={mapKeyOf(avatar)}
                        optionId={`world-avatar-option-${index}`}
                        avatar={avatar}
                        isOwned={ownedAssistantIds.has(avatarIdOf(avatar))}
                        isSelected={
                          mapFocus?.assistantId === avatarIdOf(avatar) ||
                          mapFocus?.assistantId === mapKeyOf(avatar)
                        }
                        isActive={index === activeSearchIndex}
                        onHover={() => setActiveSearchIndex(index)}
                        onChoose={chooseSearchResult}
                      />
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>

          {nearbyPinnedAvatars.length > 0 ? (
            <AvatarRosterDropdown
              icon={<MapPin className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />}
              label={`${nearbyPinnedAvatars.length} near you`}
              avatars={nearbyPinnedAvatars}
              selectedAssistantId={mapFocus?.assistantId}
              ownedAssistantIds={ownedAssistantIds}
              isOpen={isNearbyOpen}
              onToggle={() => setIsNearbyOpen((wasOpen) => !wasOpen)}
              onChoose={(place) => {
                focusPlace({
                  latitude: place.latitude,
                  longitude: place.longitude,
                  assistantId: place.assistantId,
                  source: 'nearby',
                });
                setIsNearbyOpen(false);
              }}
            />
          ) : null}
        </div>
      )}

      {selectedAvatar ? (
        <AvatarMapCard
          avatar={selectedAvatar}
          asAnonymousIdentity={asAnonymousIdentity}
          isOwned={ownedAssistantIds.has(avatarIdOf(selectedAvatar))}
          footnote={
            selectedPin
              ? `${formatCoordinate(selectedPin.latitude)}, ${formatCoordinate(selectedPin.longitude)} · ${describeGeofenceRadius(selectedPin.geofence_radius_meters)}`
              : ''
          }
          onTalk={() => openAvatar(avatarIdOf(selectedAvatar))}
        />
      ) : null}

      <div className="relative min-h-[28rem] flex-1 overflow-hidden rounded-xl border border-white/10">
        <div className="absolute inset-0">
          <Suspense
            fallback={
              <div className="flex h-full w-full items-center justify-center bg-black/60 backdrop-blur-lg">
                <span className="inline-flex items-center gap-2 text-sm text-white/50">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Building the globe…
                </span>
              </div>
            }
          >
            <WorldAvatarGlobe
              avatars={avatars}
              ownedAssistantIds={ownedAssistantIds}
              isLoading={isLoadingPins}
              loadError={pinsError}
              devicePosition={position}
              focus={mapFocus}
              worldViewRevision={worldViewRevision}
              onInspectPlace={focusPlace}
            />
          </Suspense>
        </div>
        <div
          className={`neural-nexus-minimap-frame pointer-events-auto absolute bottom-3 right-3 z-20 flex w-[min(26rem,calc(100%-1.5rem))] flex-col overflow-hidden rounded-2xl border border-amber-300/20 bg-black/80 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-xl ${
            isMinimapOpen ? 'h-[min(28rem,64%)] min-h-[18rem]' : ''
          }`}
        >
          <span
            className="pointer-events-none absolute left-2 top-2 z-30 h-3 w-3 border-l border-t border-amber-300/40"
            aria-hidden="true"
          />
          <span
            className="pointer-events-none absolute right-2 top-2 z-30 h-3 w-3 border-r border-t border-amber-300/40"
            aria-hidden="true"
          />
          <span
            className="pointer-events-none absolute bottom-2 left-2 z-30 h-3 w-3 border-b border-l border-amber-300/40"
            aria-hidden="true"
          />
          <span
            className="pointer-events-none absolute bottom-2 right-2 z-30 h-3 w-3 border-b border-r border-amber-300/40"
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={() => setIsMinimapOpen((wasOpen) => !wasOpen)}
            aria-expanded={isMinimapOpen}
            className="relative z-20 flex shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-black/55 px-3 py-2 text-left"
          >
            <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] tracking-wide text-neutral-200">
              <MapPin className="h-3 w-3 shrink-0 text-amber-300" aria-hidden="true" />
              <span className="truncate">
                Street
                {selectedAvatar?.name ? ` · ${selectedAvatar.name}` : ''}
                {listedAvatars.length > 1
                  ? ` · ${listedAvatars.length} in this place`
                  : ''}
              </span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-2">
              <span className="font-mono text-[10px] text-white/40">
                {mapFocus
                  ? `${formatCoordinate(mapFocus.latitude)}, ${formatCoordinate(mapFocus.longitude)}`
                  : 'Choose a pin'}
              </span>
              {isMinimapOpen ? (
                <ChevronUp className="h-3.5 w-3.5 text-white/50" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-white/50" aria-hidden="true" />
              )}
            </span>
          </button>
          <div
            className={
              isMinimapOpen
                ? 'relative min-h-[12rem] flex-1'
                : 'pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0'
            }
          >
            <WorldStreetMap
              appearance="minimap"
              avatars={avatars}
              devicePosition={position}
              focus={mapFocus}
              selectedAssistantId={mapFocus?.assistantId}
              ownedAssistantIds={ownedAssistantIds}
              onOpenAvatar={(avatar) => openAvatar(avatarIdOf(avatar))}
              onRemovePin={removeAvatarPin}
              onSavePin={saveAvatarPin}
              onFocusChange={focusPlace}
              savingAssistantId={savingAssistantId}
              isVisible={isMinimapOpen}
            />
            <div
              className="neural-nexus-minimap-vignette pointer-events-none absolute inset-0 z-10"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setWorldViewRevision((revision) => revision + 1)}
          className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-black/60 px-3 py-1.5 text-sm text-neutral-200 backdrop-blur-lg transition-colors hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
        >
          <Globe className="h-4 w-4 text-amber-300" aria-hidden="true" />
          Reset world view
        </button>
      </div>
    </div>
  );
};

export default WorldMapScreen;
