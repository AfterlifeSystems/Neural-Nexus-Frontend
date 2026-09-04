// src/hooks/useEmotionMedia.js
import { useCallback, useEffect, useState } from 'react';
import {
  absoluteMediaUrl,
  getAvatarEmotionMedia,
} from '../services/avatarService';

// One manifest per avatar for the life of the page. The assets themselves are
// immutable URLs the browser caches; only this small index is held here, never
// in localStorage — the portrait cache already strains the quota with data URIs
// and a manifest goes stale the moment a portrait is replaced.
const manifestCache = new Map();
const inFlight = new Map();

/**
 * Read (and cache) an avatar's emotion media manifest.
 *
 * @param {string} assistantId The avatar.
 * @param {Object} [options]
 * @param {boolean} [options.asAnonymousIdentity] Public chat: withhold the credential.
 * @param {boolean} [options.force] Bypass the cache (after a regeneration).
 * @returns {Promise<Object|null>} The manifest, or null when unavailable.
 */
export async function loadEmotionMedia(
  assistantId,
  { asAnonymousIdentity = false, force = false } = {}
) {
  if (!assistantId) return null;
  if (!force && manifestCache.has(assistantId)) {
    return manifestCache.get(assistantId);
  }
  if (!force && inFlight.has(assistantId)) {
    return inFlight.get(assistantId);
  }
  const request = (async () => {
    try {
      const manifest = await getAvatarEmotionMedia(assistantId, {
        asAnonymousIdentity,
      });
      const normalized = normalizeManifest(manifest);
      manifestCache.set(assistantId, normalized);
      return normalized;
    } catch (loadError) {
      console.debug('No emotion media for this avatar:', loadError);
      manifestCache.set(assistantId, null);
      return null;
    } finally {
      inFlight.delete(assistantId);
    }
  })();
  inFlight.set(assistantId, request);
  return request;
}

/** Forget a cached manifest (after the portrait or media was regenerated). */
export function forgetEmotionMedia(assistantId) {
  manifestCache.delete(assistantId);
}

function normalizeManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') return null;
  const emotions = {};
  for (const [emotion, entry] of Object.entries(manifest.emotions ?? {})) {
    emotions[emotion] = {
      still: entry?.still?.url ? absoluteMediaUrl(entry.still.url) : null,
      stillId: entry?.still?.asset_id ?? null,
      stillMimeType: entry?.still?.mime_type ?? null,
      stillCreatedAt: entry?.still?.created_at ?? null,
      idleLoop: entry?.idle_loop?.url ? absoluteMediaUrl(entry.idle_loop.url) : null,
      idleLoopId: entry?.idle_loop?.asset_id ?? null,
      idleLoopMimeType: entry?.idle_loop?.mime_type ?? null,
      idleLoopCreatedAt: entry?.idle_loop?.created_at ?? null,
      idleLoopDurationSeconds: entry?.idle_loop?.duration_seconds ?? null,
    };
  }
  return {
    emotions,
    complete: Boolean(manifest.complete),
    missing: manifest.missing ?? [],
  };
}

/**
 * The still for an emotion, falling back to neutral, then to nothing.
 *
 * @param {Object|null} manifest A normalized manifest.
 * @param {string} [emotion] A base emotion from the reply's sentiment.
 * @returns {string|null} An image URL or null.
 */
export function stillFor(manifest, emotion) {
  if (!manifest) return null;
  return (
    manifest.emotions?.[emotion]?.still ??
    manifest.emotions?.neutral?.still ??
    null
  );
}

/**
 * The idle loop for an emotion, falling back to neutral, then to nothing.
 *
 * @param {Object|null} manifest A normalized manifest.
 * @param {string} [emotion] A base emotion from the reply's sentiment.
 * @returns {string|null} A video URL or null.
 */
export function idleLoopFor(manifest, emotion) {
  if (!manifest) return null;
  return (
    manifest.emotions?.[emotion]?.idleLoop ??
    manifest.emotions?.neutral?.idleLoop ??
    null
  );
}

/** Decode every still and idle loop so a later swap does not wait on the network. */
export function preloadEmotionMedia(manifest) {
  if (!manifest?.emotions || typeof document === 'undefined') return;
  for (const entry of Object.values(manifest.emotions)) {
    if (entry?.still) {
      const image = new Image();
      image.src = entry.still;
    }
    if (entry?.idleLoop) {
      const video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true;
      video.playsInline = true;
      video.src = entry.idleLoop;
    }
  }
}

/**
 * React hook: the emotion media manifest for an avatar, cached across screens.
 *
 * @param {string} assistantId The avatar.
 * @param {Object} [options]
 * @param {boolean} [options.asAnonymousIdentity] Public chat: withhold the credential.
 * @returns {{manifest: Object|null, refresh: Function}}
 */
export default function useEmotionMedia(
  assistantId,
  { asAnonymousIdentity = false } = {}
) {
  const [manifest, setManifest] = useState(
    () => manifestCache.get(assistantId) ?? null
  );

  const refresh = useCallback(
    async ({ force = true } = {}) => {
      const loaded = await loadEmotionMedia(assistantId, {
        asAnonymousIdentity,
        force,
      });
      setManifest(loaded);
      return loaded;
    },
    [assistantId, asAnonymousIdentity]
  );

  useEffect(() => {
    let cancelled = false;
    setManifest(manifestCache.get(assistantId) ?? null);
    loadEmotionMedia(assistantId, { asAnonymousIdentity }).then((loaded) => {
      if (!cancelled) setManifest(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [assistantId, asAnonymousIdentity]);

  return { manifest, refresh };
}
