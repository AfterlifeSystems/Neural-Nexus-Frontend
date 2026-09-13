// src/components/geo/WorldAvatarGlobe.jsx
//
// The world globe stays on screen. Clicking a pin does not replace it: it
// names the place so the street map beside it can zoom there, and the globe
// itself flies to that spot. The surface is slippy map tiles so zoom stays
// sharp; HTML pins sit on the surface at the true lat/lng. Pins that would
// overlap at the current distance are grouped until the camera comes close
// enough for the places to separate.
//
// globe.gl carries its own copy of three.js, which is why it is imported here
// and this screen is loaded only when someone asks for it: the animated page
// background runs on a much older three.js that must not be disturbed.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Globe as GlobeIcon, Loader2, MapPin } from 'lucide-react';

import { GLOBE_TILE_ATTRIBUTION, GLOBE_TILE_URL } from '../../config/maps';
import { initialsOf } from '../../services/avatarMapMark';
import {
  GLOBE_HTML_MARKER_ALTITUDE,
  GLOBE_HTML_TRANSITION_MS,
  GLOBE_PLACE_FLY_ALTITUDE,
  GLOBE_TILE_MAX_ZOOM,
  globeMinDistance,
  slippyTileUrl,
} from '../../services/globeMap';
import {
  avatarIdOf,
  globeClusterDegreesForAltitude,
  globeMarkerGroups,
  isValidCoordinate,
  mapKeyOf,
  pinOf,
} from '../../services/avatarProximity';
import earthNightTexture from '../../assets/globe/earth-night.jpg';
import AvatarRosterDropdown from './AvatarRosterDropdown';

// Camera altitude (in globe radii) at which the whole planet is on screen.
// Double-clicking the globe flies back out to it.
const WHOLE_WORLD_ALTITUDE = 2.4;

function globeFocusKeyOf(latitude, longitude, assistantId) {
  return `${Number(latitude)}:${Number(longitude)}:${assistantId ?? ''}`;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function globeMarkerElement(group, onInspect, onHover, selectedAssistantId) {
  const el = document.createElement('button');
  el.type = 'button';
  const isSelected =
    group.avatars?.some(
      (avatar) => avatarIdOf(avatar) === selectedAssistantId
    ) ?? false;
  const ring = isSelected ? '#fbbf24' : 'rgba(251,191,36,0.55)';
  // CSS2DRenderer centers this node and overwrites its transform. A zero-size
  // root keeps that centering on the lat/lng; the inner stack's bottom tip is
  // the coordinate. Putting translate(-50%,-100%) on the same node as CSS2D
  // used to pull every pin off the street it names.
  el.style.cssText =
    'border:0;background:transparent;padding:0;margin:0;width:0;height:0;overflow:visible;cursor:pointer;pointer-events:auto;';
  const count = group.avatars?.length || group.count || 1;
  const labelAvatar = group.labelAvatar ?? group.avatars?.[0];
  const stack = document.createElement('div');
  stack.style.cssText =
    'position:absolute;left:0;top:0;transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;gap:2px;pointer-events:auto;';
  const caret = `<div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid ${ring}"></div>`;
  if (count <= 1 && labelAvatar) {
    const name = labelAvatar.name ?? 'Avatar';
    stack.innerHTML = `
      <div style="max-width:7rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:11px system-ui,sans-serif;color:#e5e5e5;background:rgba(0,0,0,0.7);padding:1px 6px;border-radius:999px;border:1px solid ${isSelected ? 'rgba(251,191,36,0.5)' : 'rgba(255,255,255,0.1)'}">${escapeHtml(name)}</div>
      <div style="width:28px;height:28px;border-radius:999px;background:rgba(0,0,0,0.75);border:2px solid ${ring};box-shadow:${isSelected ? '0 0 0 3px rgba(251,191,36,0.35)' : 'none'};color:#f5f5f5;font:700 10px system-ui,sans-serif;display:flex;align-items:center;justify-content:center">${escapeHtml(initialsOf(name))}</div>
      ${caret}`;
  } else {
    stack.innerHTML = `<div style="min-width:32px;height:32px;padding:0 8px;border-radius:999px;background:rgba(0,0,0,0.8);border:2px solid ${ring};color:#fbbf24;font:700 13px system-ui,sans-serif;display:flex;align-items:center;justify-content:center">${count}</div>${caret}`;
  }
  el.appendChild(stack);
  el.addEventListener('click', (event) => {
    event.stopPropagation();
    onInspect(group);
  });
  el.addEventListener('mouseenter', () => onHover(group));
  el.addEventListener('mouseleave', () => onHover(null));
  return el;
}

/**
 * @param {Object} props
 * @param {Array<Object>} props.avatars
 * @param {boolean} [props.isLoading]
 * @param {string} [props.loadError]
 * @param {Object|null} [props.devicePosition]
 * @param {Object|null} [props.focus]
 * @param {Set<string>} [props.ownedAssistantIds]
 * @param {number} [props.worldViewRevision] bump to fly out to the whole world
 * @param {(place: {latitude: number, longitude: number, avatars: Array})} props.onInspectPlace
 * @param {() => void} [props.onViewWholeWorld] The toolbar Reset world view
 *   companion: collapse the street inset when the roster flies out.
 */
const WorldAvatarGlobe = ({
  avatars = [],
  ownedAssistantIds,
  isLoading = false,
  loadError = '',
  devicePosition = null,
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
  const hasFlownToDeviceRef = useRef(false);
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
      controls.autoRotate = true;
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
      globeInstance = new Globe(container)
        .backgroundColor('rgba(0,0,0,0)')
        .globeImageUrl(earthNightTexture)
        .showAtmosphere(true)
        .atmosphereColor('#427abc')
        .atmosphereAltitude(0.07);
      if (typeof globeInstance.globeTileEngineUrl === 'function') {
        globeInstance.globeTileEngineUrl((tileX, tileY, zoomLevel) =>
          slippyTileUrl(GLOBE_TILE_URL, tileX, tileY, zoomLevel)
        );
      }
      if (typeof globeInstance.globeTileEngineMaxLevel === 'function') {
        globeInstance.globeTileEngineMaxLevel(GLOBE_TILE_MAX_ZOOM);
      } else if (typeof globeInstance.globeTileEngineMaxZoom === 'function') {
        globeInstance.globeTileEngineMaxZoom(GLOBE_TILE_MAX_ZOOM);
      }
      const controls = globeInstance.controls();
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.35;
      const globeRadius = globeInstance.getGlobeRadius?.() ?? 100;
      if (typeof controls.minDistance === 'number') {
        controls.minDistance = globeMinDistance(globeRadius);
      }
      const camera = globeInstance.camera?.();
      if (camera && typeof camera.near === 'number') {
        camera.near = Math.min(camera.near, globeRadius * 0.0002);
        camera.updateProjectionMatrix?.();
      }
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
    globeInstance
      .htmlElementsData(groups)
      .htmlLat('latitude')
      .htmlLng('longitude')
      .htmlAltitude(GLOBE_HTML_MARKER_ALTITUDE)
      .htmlTransitionDuration(GLOBE_HTML_TRANSITION_MS)
      .htmlElement((group) =>
        globeMarkerElement(
          group,
          inspectGroup,
          (hovered) => {
            setHoveredGroup(hovered);
            if (holdStillRef.current) {
              globeInstance.controls().autoRotate = false;
              return;
            }
            globeInstance.controls().autoRotate = !hovered;
          },
          selectedAssistantId
        )
      );
  }, [groups, inspectGroup, globeReady, selectedAssistantId]);

  useEffect(() => {
    const globeInstance = globeRef.current;
    if (!globeInstance || !globeReady) return;
    const rings = [];
    if (devicePosition) {
      rings.push({
        latitude: devicePosition.latitude,
        longitude: devicePosition.longitude,
        kind: 'device',
      });
    }
    if (isValidCoordinate(focus?.latitude, focus?.longitude)) {
      rings.push({
        latitude: focus.latitude,
        longitude: focus.longitude,
        kind: 'focus',
      });
    }
    globeInstance
      .ringsData(rings)
      .ringLat('latitude')
      .ringLng('longitude')
      .ringColor((ring) =>
        ring.kind === 'focus'
          ? () => 'rgba(251,191,36,0.85)'
          : () => 'rgba(255,255,255,0.85)'
      )
      .ringMaxRadius((ring) => (ring.kind === 'focus' ? 0.55 : 0.35))
      .ringPropagationSpeed(1.2)
      .ringRepeatPeriod(1400);
    if (!devicePosition || hasFlownToDeviceRef.current) return;
    hasFlownToDeviceRef.current = true;
    globeInstance.controls().autoRotate = false;
    globeInstance.pointOfView(
      {
        lat: devicePosition.latitude,
        lng: devicePosition.longitude,
        altitude: GLOBE_PLACE_FLY_ALTITUDE,
      },
      1200
    );
  }, [devicePosition, focus, globeReady]);

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
    if (focus.source && focus.source !== 'seed') {
      holdStill();
    }
    globeInstance.controls().autoRotate = false;
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
