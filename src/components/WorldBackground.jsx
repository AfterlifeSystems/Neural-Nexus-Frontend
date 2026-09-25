// src/components/WorldBackground.jsx
//
// Persistent world globe behind every screen. Same surface as the map globe
// (night texture, slippy tiles, atmosphere, HTML pins). On /map it unmounts so
// the interactive globe is the only WebGL world. For a signed-in account only
// carousel avatars keep their pins; hidden or never-added cards stay off the
// planet. Selecting an avatar (gallery front card, chat, or a shared link)
// flies the camera to that pin when the avatar has a location; without a pin
// the planet keeps its idle spin.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { isAdminAccount } from '../config/adminAccount';
import { maySeeAdultOnlyAvatarInSearch } from '../services/adultOnlyAvatar';
import {
  avatarsVisibleOnGlobe,
  readHiddenCarouselAvatarIds,
  subscribeHiddenCarouselAvatarIds,
} from '../services/avatarCarouselMembership';
import { listGeoAvatars } from '../services/avatarService';
import {
  avatarIdOf,
  globeClusterDegreesForAltitude,
  globeMarkerGroups,
  mergePinnedAvatars,
} from '../services/avatarProximity';
import {
  GLOBE_PLACE_FLY_ALTITUDE,
  WHOLE_WORLD_ALTITUDE,
  worldGlobeAutoRotateEnabled,
} from '../services/globeMap';
import {
  avatarIdForGlobeFocus,
  focusedGlobeAvatarFromLists,
  geoListingIdentityForViewer,
  getGalleryFocusedAssistantId,
  isWorldMapPath,
  subscribeGalleryFocusedAssistantId,
} from '../services/worldBackgroundFocus';
import {
  applyWorldGlobeHtmlPins,
  applyWorldGlobeSurface,
} from './geo/worldGlobeSurface';

function flyDurationMs() {
  if (typeof window === 'undefined') return 900;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 0
    : 900;
}

function prefersReducedMotion() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function sameFocusedGlobeAvatar(left, right) {
  if (left === right) return true;
  if (!left || !right) return false;
  return (
    String(avatarIdOf(left.avatar) ?? '') ===
      String(avatarIdOf(right.avatar) ?? '') &&
    Number(left.pin?.latitude) === Number(right.pin?.latitude) &&
    Number(left.pin?.longitude) === Number(right.pin?.longitude)
  );
}

const WorldBackground = () => {
  const containerRef = useRef(null);
  const globeRef = useRef(null);
  const lastFocusKeyRef = useRef('');
  const { pathname } = useLocation();
  const { activeAvatar, ageVerified, user, userAvatars } = useAuth();
  const showGlobe = !isWorldMapPath(pathname);
  const [galleryAssistantId, setGalleryAssistantId] = useState(
    getGalleryFocusedAssistantId
  );
  const selectedAssistantId = avatarIdForGlobeFocus(
    pathname,
    galleryAssistantId
  );
  const [globeReady, setGlobeReady] = useState(false);
  const [focusedAvatar, setFocusedAvatar] = useState(null);
  const [publicAvatars, setPublicAvatars] = useState([]);
  const [hiddenCarouselIds, setHiddenCarouselIds] = useState([]);
  const [groupingDegrees, setGroupingDegrees] = useState(0.8);
  const holdStillRef = useRef(false);
  holdStillRef.current = Boolean(focusedAvatar?.pin);

  useEffect(
    () => subscribeGalleryFocusedAssistantId(setGalleryAssistantId),
    []
  );

  useEffect(() => {
    const userId = user?.id;
    setHiddenCarouselIds(readHiddenCarouselAvatarIds(userId));
    return subscribeHiddenCarouselAvatarIds((changedUserId, nextHiddenIds) => {
      if (String(changedUserId) !== String(userId ?? '')) return;
      setHiddenCarouselIds(nextHiddenIds);
    });
  }, [user?.id]);

  const pinnedAvatars = useMemo(
    () =>
      avatarsVisibleOnGlobe(
        mergePinnedAvatars(publicAvatars, userAvatars).filter((avatar) =>
          maySeeAdultOnlyAvatarInSearch(avatar, {
            ageVerified,
            isAdmin: isAdminAccount(user),
          })
        ),
        {
          galleryAvatars: userAvatars,
          hiddenCarouselIds,
          hasSignedInAccount: Boolean(user?.id),
        }
      ),
    [ageVerified, hiddenCarouselIds, publicAvatars, user, userAvatars]
  );

  const pinGroups = useMemo(
    () => globeMarkerGroups(pinnedAvatars, groupingDegrees),
    [groupingDegrees, pinnedAvatars]
  );

  useEffect(() => {
    if (!showGlobe) {
      setPublicAvatars([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const identity = geoListingIdentityForViewer(user);
      for (let attempt = 0; attempt < 4; attempt += 1) {
        if (cancelled) return;
        try {
          const pinned = await listGeoAvatars(identity);
          if (!cancelled) setPublicAvatars(pinned ?? []);
          return;
        } catch {
          if (attempt === 3) return;
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * 2 ** attempt)
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showGlobe, user]);

  useEffect(() => {
    if (!showGlobe || !selectedAssistantId) {
      setFocusedAvatar(null);
      return undefined;
    }
    const known = focusedGlobeAvatarFromLists(selectedAssistantId, [
      activeAvatar,
      ...(userAvatars ?? []),
      ...pinnedAvatars,
    ]);
    if (known) {
      setFocusedAvatar((previous) =>
        sameFocusedGlobeAvatar(previous, known) ? previous : known
      );
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const hits = await listGeoAvatars({
          assistantId: selectedAssistantId,
          ...geoListingIdentityForViewer(user),
        });
        if (cancelled) return;
        const fromHits = focusedGlobeAvatarFromLists(
          selectedAssistantId,
          hits
        );
        setFocusedAvatar((previous) => {
          if (sameFocusedGlobeAvatar(previous, fromHits)) return previous;
          return fromHits;
        });
      } catch {
        if (!cancelled) setFocusedAvatar(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    activeAvatar,
    pinnedAvatars,
    selectedAssistantId,
    showGlobe,
    user,
    userAvatars,
  ]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !showGlobe) {
      setGlobeReady(false);
      return undefined;
    }

    let globeInstance = null;
    let isMounted = true;
    let observer = null;
    let motionQuery = null;
    let altitudeTimer = 0;

    const applyAutoRotate = () => {
      const controls = globeInstance?.controls?.();
      if (!controls) return;
      controls.autoRotate = worldGlobeAutoRotateEnabled({
        prefersReducedMotion: Boolean(motionQuery?.matches),
        hasFocusedPlace: holdStillRef.current,
      });
    };

    (async () => {
      const { default: Globe } = await import('globe.gl');
      if (!isMounted || !containerRef.current) return;

      globeInstance = new Globe(container);
      applyWorldGlobeSurface(globeInstance, {
        autoRotate: worldGlobeAutoRotateEnabled({
          hasFocusedPlace: holdStillRef.current,
        }),
        enableRotate: false,
        enableZoom: false,
        enablePan: false,
      });
      globeInstance.pointOfView(
        { lat: 20, lng: 0, altitude: WHOLE_WORLD_ALTITUDE },
        0
      );

      motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      applyAutoRotate();
      motionQuery.addEventListener?.('change', applyAutoRotate);

      const resize = () => {
        globeInstance.width(container.clientWidth);
        globeInstance.height(container.clientHeight);
      };
      resize();
      observer = new ResizeObserver(resize);
      observer.observe(container);
      altitudeTimer = window.setInterval(() => {
        applyAutoRotate();
        const altitude = globeInstance.pointOfView()?.altitude;
        setGroupingDegrees((current) => {
          const next = globeClusterDegreesForAltitude(altitude);
          return next === current ? current : next;
        });
      }, 400);
      globeRef.current = globeInstance;
      setGlobeReady(true);
    })();

    return () => {
      isMounted = false;
      motionQuery?.removeEventListener?.('change', applyAutoRotate);
      observer?.disconnect();
      if (altitudeTimer) window.clearInterval(altitudeTimer);
      globeRef.current = null;
      setGlobeReady(false);
      lastFocusKeyRef.current = '';
      if (globeInstance?._destructor) globeInstance._destructor();
      container.replaceChildren();
    };
  }, [showGlobe]);

  useEffect(() => {
    const globeInstance = globeRef.current;
    if (!globeInstance || !globeReady) return;

    const controls = globeInstance.controls();
    const duration = flyDurationMs();
    const reduceMotion = prefersReducedMotion();
    const hasFocusedPlace = holdStillRef.current;

    applyWorldGlobeHtmlPins(globeInstance, pinGroups, {
      selectedAssistantId,
      interactive: false,
    });

    globeInstance.ringsData([]);
    controls.autoRotate = worldGlobeAutoRotateEnabled({
      prefersReducedMotion: reduceMotion,
      hasFocusedPlace,
    });

    if (focusedAvatar?.pin) {
      const pin = focusedAvatar.pin;
      const assistantId = avatarIdOf(focusedAvatar.avatar);
      const focusKey = `${pin.latitude}:${pin.longitude}:${assistantId ?? ''}`;
      if (lastFocusKeyRef.current !== focusKey) {
        lastFocusKeyRef.current = focusKey;
        globeInstance.pointOfView(
          {
            lat: Number(pin.latitude),
            lng: Number(pin.longitude),
            altitude: GLOBE_PLACE_FLY_ALTITUDE,
          },
          duration
        );
      }
      return;
    }

    if (lastFocusKeyRef.current !== 'world') {
      lastFocusKeyRef.current = 'world';
      const current = globeInstance.pointOfView?.() ?? {};
      globeInstance.pointOfView(
        {
          lat: current.lat ?? 20,
          lng: current.lng ?? 0,
          altitude: WHOLE_WORLD_ALTITUDE,
        },
        duration
      );
    }
  }, [focusedAvatar, globeReady, pinGroups, selectedAssistantId]);

  if (!showGlobe) return null;

  return (
    <div
      ref={containerRef}
      className="world-background fixed inset-0"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  );
};

export default WorldBackground;
