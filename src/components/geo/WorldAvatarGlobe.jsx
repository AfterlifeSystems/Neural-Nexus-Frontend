// src/components/geo/WorldAvatarGlobe.jsx
//
// The world globe stays on screen. Clicking a pin does not replace it: it
// names the place so the street map beside it can zoom there, and the globe
// itself flies to that spot. The surface is slippy map tiles so zoom stays
// sharp; HTML pins sit on the surface at the true lat/lng. Pins that would
// overlap at the current distance are grouped until the camera comes close
// enough for the places to separate.
//
// globe.gl is imported here, not at module load, so the page background's
// globe and this interactive one never share a WebGL context. The background
// unmounts while this screen is open.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Globe as GlobeIcon, Loader2, MapPin } from 'lucide-react';

import { GLOBE_TILE_ATTRIBUTION } from '../../config/maps';
import {
  GLOBE_PLACE_FLY_ALTITUDE,
  WHOLE_WORLD_ALTITUDE,
  worldGlobeAutoRotateEnabled,
} from '../../services/globeMap';
import {
  avatarIdOf,
  globeClusterDegreesForAltitude,
  globeMarkerGroups,
  isValidCoordinate,
  mapKeyOf,
  pinOf,
} from '../../services/avatarProximity';
import { applyWorldGlobeHtmlPins, applyWorldGlobeSurface } from './worldGlobeSurface';
import AvatarRosterDropdown from './AvatarRosterDropdown';

function globeFocusKeyOf(latitude, longitude, assistantId) {
  return `${Number(latitude)}:${Number(longitude)}:${assistantId ?? ''}`;
}

/**
 * @param {Object} props
 * @param {Array<Object>} props.avatars
 * @param {boolean} [props.isLoading]
 * @param {string} [props.loadError]
 * @param {Object|null} [props.focus]
 * @param {Set<string>} [props.ownedAssistantIds]
 * @param {number} [props.worldViewRevision] bump to fly out to the whole world
 * @param {(place: {latitude: number, longitude: number, avatars: Array})} props.onInspectPlace
 * @param {() => void} [props.onViewWholeWorld] Fold the street inset and
 *   drop the selected place. The toolbar Reset world view also bumps
 *   worldViewRevision so this globe flies out; the roster calls this
 *   without that bump so the name list can stay open.
 */
const WorldAvatarGlobe = ({
  avatars = [],
  ownedAssistantIds,
  isLoading = false,
  loadError = '',
  focus = null,
  worldViewRevision = 0,
  onInspectPlace,
  onViewWholeWorld,
}) => {
  const selectedAssistantId = focus?.assistantId ?? null;
  const containerRef = useRef(null);
  const globeRef = useRef(null);
  const [groupingDegrees, setGroupingDegrees] = useState(0.8);
  const [hoveredGroup, setHoveredGroup] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [isListOpen, setIsListOpen] = useState(false);
  const [globeReady, setGlobeReady] = useState(false);
  const lastFocusKeyRef = useRef('');
  const lastPinInspectAtRef = useRef(0);
  const lastGlobeClickAtRef = useRef(0);
  const holdStillRef = useRef(false);
  const onInspectPlaceRef = useRef(onInspectPlace);
  onInspectPlaceRef.current = onInspectPlace;
  const onViewWholeWorldRef = useRef(onViewWholeWorld);
  onViewWholeWorldRef.current = onViewWholeWorld;

  const holdStill = useCallback(() => {
    holdStillRef.current = true;
    const controls = globeRef.current?.controls?.();
    if (controls) {
      controls.autoRotate = false;
    }
  }, []);

  const flyToAvatar = useCallback(
    (latitude, longitude, assistantId) => {
      const globeInstance = globeRef.current;
      if (!globeInstance || !isValidCoordinate(latitude, longitude)) return;
      lastFocusKeyRef.current = globeFocusKeyOf(
        latitude,
        longitude,
        assistantId
      );
      holdStill();
      globeInstance.controls().autoRotate = false;
      globeInstance.pointOfView(
        {
          lat: Number(latitude),
          lng: Number(longitude),
          altitude: GLOBE_PLACE_FLY_ALTITUDE,
        },
        900
      );
    },
    [holdStill]
  );

  // Pull the camera back until the whole planet fits, forget any place that
  // was opened, and let the globe drift again. The roster's "N avatars in
  // the world" row keeps the list open so a name can be chosen next.
  const viewWholeWorld = useCallback((options = {}) => {
    const globeInstance = globeRef.current;
    if (!globeInstance) return;
    const current = globeInstance.pointOfView?.() ?? {};
    holdStillRef.current = false;
    lastFocusKeyRef.current = 'world';
    setSelectedGroup(null);
    setIsListOpen(Boolean(options.keepListOpen));
    globeInstance.pointOfView(
      {
        lat: current.lat ?? 20,
        lng: current.lng ?? 0,
        altitude: WHOLE_WORLD_ALTITUDE,
      },
      900
    );
    const controls = globeInstance.controls?.();
    if (controls) {
      controls.autoRotate = worldGlobeAutoRotateEnabled();
    }
  }, []);
  const viewWholeWorldRef = useRef(viewWholeWorld);
  viewWholeWorldRef.current = viewWholeWorld;

  // The toolbar's "World view" button bumps this number.
  useEffect(() => {
    if (!worldViewRevision || !globeReady) return;
    viewWholeWorld();
  }, [worldViewRevision, globeReady, viewWholeWorld]);

  const groups = useMemo(
    () => globeMarkerGroups(avatars, groupingDegrees),
    [avatars, groupingDegrees]
  );

  const inspectGroup = useCallback(
    (group) => {
      if (!group) return;
      lastPinInspectAtRef.current = Date.now();
      holdStill();
      const groupSize = group.avatars?.length || group.count || 1;
      const chosen =
        groupSize === 1 ? (group.labelAvatar ?? group.avatars?.[0]) : null;
      const pin = chosen ? pinOf(chosen) : null;
      const latitude = pin ? Number(pin.latitude) : group.latitude;
      const longitude = pin ? Number(pin.longitude) : group.longitude;
      const assistantId = chosen
        ? avatarIdOf(chosen) ?? mapKeyOf(chosen)
        : null;
      flyToAvatar(latitude, longitude, assistantId);
      onInspectPlaceRef.current?.({
        latitude,
        longitude,
        assistantId,
        avatars: group.avatars,
        source: 'globe',
      });
      setSelectedGroup(group);
      setIsListOpen(true);
    },
    [flyToAvatar]
  );

  const rosterGroup = useMemo(() => {
    if (!selectedGroup) return null;
    const selectedIds = new Set(
      (selectedGroup.avatars ?? [])
        .map((avatar) => avatarIdOf(avatar))
        .filter(Boolean)
    );
    if (selectedAssistantId) selectedIds.add(selectedAssistantId);
    return (
      groups.find((group) =>
        group.avatars.some((avatar) => selectedIds.has(avatarIdOf(avatar)))
      ) ?? selectedGroup
    );
  }, [groups, selectedAssistantId, selectedGroup]);

  const listAvatars = rosterGroup?.avatars?.length
    ? rosterGroup.avatars
    : avatars;

  const listLabel = useMemo(() => {
    if (rosterGroup?.avatars?.length) {
      const count = rosterGroup.avatars.length;
      const sharedPlace = rosterGroup.avatars
        .map((avatar) => pinOf(avatar)?.location_name)
        .find(Boolean);
      if (count === 1) {
        return rosterGroup.avatars[0]?.name || '1 avatar';
      }
      return sharedPlace
        ? `${count} avatars at ${sharedPlace}`
        : `${count} avatars in this place`;
    }
    const count = avatars.length;
    const placeCount =
      groups.length > 0 && groups.length < count
        ? ` · ${groups.length} places`
        : '';
    return `${count} ${count === 1 ? 'avatar' : 'avatars'} in the world${placeCount}`;
  }, [avatars.length, groups.length, rosterGroup]);

  const chooseFromList = useCallback(
    (place) => {
      const containing = groups.find((group) =>
        group.avatars.some(
          (avatar) =>
            avatarIdOf(avatar) === place.assistantId ||
            mapKeyOf(avatar) === place.assistantId
        )
      );
      if (containing) setSelectedGroup(containing);
      flyToAvatar(place.latitude, place.longitude, place.assistantId);
      onInspectPlaceRef.current?.({
        ...place,
        avatars: containing?.avatars,
        preserveGroup: Boolean(containing),
      });
    },
    [flyToAvatar, groups]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let globeInstance = null;
    let isMounted = true;
    let stopWatchingAltitude = () => {};

    (async () => {
      const { default: Globe } = await import('globe.gl');
      if (!isMounted) return;
      globeInstance = new Globe(container);
      const { controls } = applyWorldGlobeSurface(globeInstance);
      const stopDrift = () => {
        holdStillRef.current = true;
        controls.autoRotate = false;
      };
      controls.addEventListener?.('start', stopDrift);
      if (typeof globeInstance.onGlobeClick === 'function') {
        globeInstance.onGlobeClick(({ lat, lng }) => {
          const now = Date.now();
          if (now - lastPinInspectAtRef.current < 400) return;
          // Two taps on open globe within a moment: show the whole world.
          if (now - lastGlobeClickAtRef.current < 350) {
            lastGlobeClickAtRef.current = 0;
            viewWholeWorldRef.current?.();
            onViewWholeWorldRef.current?.();
            return;
          }
          lastGlobeClickAtRef.current = now;
          stopDrift();
          setSelectedGroup(null);
          onInspectPlaceRef.current?.({
            latitude: lat,
            longitude: lng,
            avatars: [],
            source: 'globe',
          });
        });
      }
      globeRef.current = globeInstance;
      // Opening /map is Reset world view: the whole planet, already drifting.
      // Device GPS and the first pin wait until the person chooses a place.
      globeInstance.pointOfView(
        { lat: 20, lng: 0, altitude: WHOLE_WORLD_ALTITUDE },
        0
      );
      lastFocusKeyRef.current = 'world';
      setGlobeReady(true);

      const resize = () => {
        globeInstance.width(container.clientWidth);
        globeInstance.height(container.clientHeight);
      };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(container);

      const altitudeTimer = window.setInterval(() => {
        if (holdStillRef.current) {
          globeInstance.controls().autoRotate = false;
        }
        const altitude = globeInstance.pointOfView()?.altitude;
        setGroupingDegrees((current) => {
          const next = globeClusterDegreesForAltitude(altitude);
          return next === current ? current : next;
        });
      }, 400);

      stopWatchingAltitude = () => {
        observer.disconnect();
        window.clearInterval(altitudeTimer);
      };
    })();

    return () => {
      isMounted = false;
      stopWatchingAltitude();
      globeRef.current = null;
      if (globeInstance?._destructor) globeInstance._destructor();
      container.replaceChildren();
    };
  }, []);

  useEffect(() => {
    const globeInstance = globeRef.current;
    if (!globeInstance || !globeReady) return;
    applyWorldGlobeHtmlPins(globeInstance, groups, {
      onInspect: inspectGroup,
      onHover: (hovered) => {
        setHoveredGroup(hovered);
        globeInstance.controls().autoRotate = worldGlobeAutoRotateEnabled({
          hasFocusedPlace: holdStillRef.current,
          isHovered: Boolean(hovered),
        });
      },
      selectedAssistantId,
      interactive: true,
    });
  }, [groups, inspectGroup, globeReady, selectedAssistantId]);

  useEffect(() => {
    const globeInstance = globeRef.current;
    if (
      !globeInstance ||
      !globeReady ||
      !isValidCoordinate(focus?.latitude, focus?.longitude)
    ) {
      return;
    }
    const focusKey = globeFocusKeyOf(
      focus.latitude,
      focus.longitude,
      focus.assistantId
    );
    if (lastFocusKeyRef.current === focusKey) return;
    lastFocusKeyRef.current = focusKey;
    holdStill();
    globeInstance.pointOfView(
      {
        lat: focus.latitude,
        lng: focus.longitude,
        altitude: GLOBE_PLACE_FLY_ALTITUDE,
      },
      900
    );
  }, [focus, globeReady, holdStill]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-black/60">
      <div ref={containerRef} className="h-full w-full" />

      <div className="pointer-events-auto absolute inset-x-3 top-3 z-20 flex items-start gap-2 sm:inset-x-4 sm:top-4">
        <div className="min-w-0 flex-1 sm:w-96 sm:flex-none">
          {isLoading ? (
            <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-xs text-neutral-200 backdrop-blur-lg">
              <GlobeIcon
                className="h-4 w-4 text-amber-300"
                aria-hidden="true"
              />
              <span className="inline-flex items-center gap-1.5">
                <Loader2
                  className="h-3.5 w-3.5 animate-spin"
                  aria-hidden="true"
                />
                Loading the world…
              </span>
            </div>
          ) : (
            <AvatarRosterDropdown
              icon={
                rosterGroup ? (
                  <MapPin
                    className="h-4 w-4 shrink-0 text-amber-300"
                    aria-hidden="true"
                  />
                ) : (
                  <GlobeIcon
                    className="h-4 w-4 shrink-0 text-amber-300"
                    aria-hidden="true"
                  />
                )
              }
              label={listLabel}
              avatars={listAvatars}
              selectedAssistantId={selectedAssistantId}
              isOpen={isListOpen}
              onToggle={() => setIsListOpen((wasOpen) => !wasOpen)}
              onChoose={chooseFromList}
              ownedAssistantIds={ownedAssistantIds}
              worldActionLabel={
                rosterGroup
                  ? `${avatars.length} ${avatars.length === 1 ? 'avatar' : 'avatars'} in the world`
                  : undefined
              }
              onShowWorld={
                rosterGroup
                  ? () => {
                      viewWholeWorld({ keepListOpen: true });
                      onViewWholeWorldRef.current?.();
                    }
                  : undefined
              }
            />
          )}
        </div>
      </div>

      {hoveredGroup && !isListOpen && (
        <div className="pointer-events-none absolute left-4 top-14 max-w-xs rounded-lg border border-white/10 bg-black/80 px-3 py-2 backdrop-blur-lg">
          {hoveredGroup.count === 1 ? (
            <>
              <p className="text-sm font-medium text-neutral-100">
                {(hoveredGroup.labelAvatar ?? hoveredGroup.avatars[0])?.name}
              </p>
              {pinOf(hoveredGroup.labelAvatar ?? hoveredGroup.avatars[0])
                ?.location_name && (
                <p className="text-xs text-amber-300">
                  {
                    pinOf(hoveredGroup.labelAvatar ?? hoveredGroup.avatars[0])
                      .location_name
                  }
                </p>
              )}
              {(hoveredGroup.labelAvatar ?? hoveredGroup.avatars[0])
                ?.description && (
                <p className="mt-1 line-clamp-3 text-xs text-white/60">
                  {
                    (hoveredGroup.labelAvatar ?? hoveredGroup.avatars[0])
                      .description
                  }
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-neutral-100">
                {hoveredGroup.count} avatars here
              </p>
              <ul className="mt-1 max-h-28 space-y-0.5 overflow-y-auto text-xs text-white/70">
                {hoveredGroup.avatars.map((avatar) => (
                  <li key={avatarIdOf(avatar) ?? avatar.name}>
                    {avatar.name ?? 'Avatar'}
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="mt-1 text-xs text-white/40">
            Click to show this place on the street map.
          </p>
        </div>
      )}

      {loadError && (
        <p className="absolute bottom-4 left-4 rounded-lg border border-white/10 bg-black/80 px-3 py-2 text-xs text-red-300 backdrop-blur-lg">
          {loadError}
        </p>
      )}
      {GLOBE_TILE_ATTRIBUTION ? (
        <p className="pointer-events-none absolute bottom-2 left-2 z-10 max-w-[min(24rem,calc(100%-6rem))] truncate text-[10px] text-white/40">
          {GLOBE_TILE_ATTRIBUTION}
        </p>
      ) : null}
    </div>
  );
};

export default WorldAvatarGlobe;
