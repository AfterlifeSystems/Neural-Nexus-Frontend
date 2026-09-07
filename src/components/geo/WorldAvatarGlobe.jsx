// src/components/geo/WorldAvatarGlobe.jsx
//
// The world map: every public avatar pinned to a real-world place, on a globe
// you can spin. Pins that would land on top of each other at the current
// distance are grouped into a single counted point, so a city reads as one mark
// until you come close enough for the individual places to separate.
//
// globe.gl carries its own copy of three.js, which is why it is imported here
// and this screen is loaded only when someone asks for it: the animated page
// background runs on a much older three.js that must not be disturbed.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Globe as GlobeIcon, Loader2 } from 'lucide-react';

import { clusterPins, pinOf } from '../../services/avatarProximity';
import { listGeoAvatars } from '../../services/avatarService';
import earthNightTexture from '../../assets/globe/earth-night.jpg';

// How coarsely pins are grouped, by how far the camera has pulled back. The
// altitude globe.gl reports is roughly one Earth radius at the default view.
function groupingDegreesForAltitude(altitude) {
  if (!Number.isFinite(altitude)) return 5;
  if (altitude > 1.5) return 12;
  if (altitude > 0.8) return 5;
  if (altitude > 0.4) return 1.5;
  if (altitude > 0.15) return 0.3;
  return 0.02;
}

/**
 * @param {Object} props
 * @param {boolean} [props.asAnonymousIdentity] Load the pins without the stored credential.
 * @param {(avatar: Object) => void} props.onOpenAvatar Open one avatar.
 */
const WorldAvatarGlobe = ({
  asAnonymousIdentity = false,
  devicePosition = null,
  onOpenAvatar,
}) => {
  const containerRef = useRef(null);
  const globeRef = useRef(null);
  const [avatars, setAvatars] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [groupingDegrees, setGroupingDegrees] = useState(5);
  const [hoveredGroup, setHoveredGroup] = useState(null);
  const hasFlownToDeviceRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const pinned = await listGeoAvatars({ asAnonymousIdentity });
        if (isMounted) setAvatars(pinned);
      } catch {
        if (isMounted) {
          setLoadError(
            'The pinned avatars could not be loaded. Try again shortly.'
          );
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [asAnonymousIdentity]);

  const groups = useMemo(
    () => clusterPins(avatars, groupingDegrees),
    [avatars, groupingDegrees]
  );

  const openGroup = useCallback(
    (group) => {
      if (!group) return;
      if (group.count === 1) {
        onOpenAvatar?.(group.avatars[0]);
        return;
      }
      // A group is a place to fly to, not an avatar to open: coming closer
      // splits the group into the individual places.
      globeRef.current?.pointOfView(
        { lat: group.latitude, lng: group.longitude, altitude: 0.25 },
        900
      );
    },
    [onOpenAvatar]
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
        .atmosphereColor('#fbbf24')
        .atmosphereAltitude(0.14);
      globeInstance.controls().autoRotate = true;
      globeInstance.controls().autoRotateSpeed = 0.35;
      globeRef.current = globeInstance;

      const resize = () => {
        globeInstance.width(container.clientWidth);
        globeInstance.height(container.clientHeight);
      };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(container);

      // The grouping follows the camera, so pulling back merges places and
      // coming closer separates them.
      const altitudeTimer = window.setInterval(() => {
        const altitude = globeInstance.pointOfView()?.altitude;
        setGroupingDegrees((current) => {
          const next = groupingDegreesForAltitude(altitude);
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
    if (!globeInstance) return;
    globeInstance
      .pointsData(groups)
      .pointLat('latitude')
      .pointLng('longitude')
      .pointAltitude((group) => 0.01 + Math.min(0.12, group.count * 0.012))
      .pointRadius(
        (group) => 0.25 + Math.min(1.2, Math.log2(group.count + 1) * 0.35)
      )
      .pointColor(() => '#fbbf24')
      .pointLabel((group) =>
        group.count === 1
          ? `<div style="font: 12px system-ui; color: #e5e5e5">${group.avatars[0].name ?? 'Avatar'}</div>`
          : `<div style="font: 12px system-ui; color: #e5e5e5">${group.count} avatars here</div>`
      )
      .onPointHover((group) => {
        setHoveredGroup(group ?? null);
        const controls = globeInstance.controls();
        controls.autoRotate = !group;
      })
      .onPointClick(openGroup);
  }, [groups, openGroup]);

  useEffect(() => {
    const globeInstance = globeRef.current;
    if (!globeInstance || !devicePosition) return;
    globeInstance
      .ringsData([devicePosition])
      .ringLat('latitude')
      .ringLng('longitude')
      .ringColor(() => () => 'rgba(255,255,255,0.85)')
      .ringMaxRadius(2.5)
      .ringPropagationSpeed(1.2)
      .ringRepeatPeriod(1400);
    // Fly to the person once, on the first fix: doing it on every update would
    // fight anyone who has since spun the globe somewhere else.
    if (hasFlownToDeviceRef.current) return;
    hasFlownToDeviceRef.current = true;
    globeInstance.controls().autoRotate = false;
    globeInstance.pointOfView(
      {
        lat: devicePosition.latitude,
        lng: devicePosition.longitude,
        altitude: 0.6,
      },
      1200
    );
  }, [devicePosition]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-white/10 bg-black/60 backdrop-blur-lg">
      <div ref={containerRef} className="h-full w-full" />

      <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-xs text-neutral-200 backdrop-blur-lg">
        <GlobeIcon className="h-4 w-4 text-amber-300" aria-hidden="true" />
        {isLoading ? (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Loading the world…
          </span>
        ) : (
          <span>
            {avatars.length}{' '}
            {avatars.length === 1 ? 'avatar stands' : 'avatars stand'} in the
            world
          </span>
        )}
      </div>

      {hoveredGroup && hoveredGroup.count === 1 && (
        <div className="pointer-events-none absolute bottom-4 left-4 max-w-xs rounded-lg border border-white/10 bg-black/80 px-3 py-2 backdrop-blur-lg">
          <p className="text-sm font-medium text-neutral-100">
            {hoveredGroup.avatars[0].name}
          </p>
          {pinOf(hoveredGroup.avatars[0])?.location_name && (
            <p className="text-xs text-amber-300">
              {pinOf(hoveredGroup.avatars[0]).location_name}
            </p>
          )}
          {hoveredGroup.avatars[0].description && (
            <p className="mt-1 line-clamp-3 text-xs text-white/60">
              {hoveredGroup.avatars[0].description}
            </p>
          )}
          <p className="mt-1 text-xs text-white/40">Click the pin to talk.</p>
        </div>
      )}

      {loadError && (
        <p className="absolute bottom-4 right-4 rounded-lg border border-white/10 bg-black/80 px-3 py-2 text-xs text-red-300 backdrop-blur-lg">
          {loadError}
        </p>
      )}
    </div>
  );
};

export default WorldAvatarGlobe;
