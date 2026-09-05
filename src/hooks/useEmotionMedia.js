// src/hooks/useEmotionMedia.js
import { useCallback, useEffect, useState } from 'react';
import {
  absoluteMediaUrl,
  getAvatarEmotionMedia,
} from '../services/avatarService';
import { subscribeAvatarPortraitChanged } from '../services/avatarPortraitEvents';

// One manifest per avatar for the life of the page. The assets themselves are
// immutable URLs the browser caches; only this small index is held here, never
// in localStorage — the portrait cache already strains the quota with data URIs
// and a manifest goes stale the moment a portrait is replaced.
const manifestCache = new Map();
const inFlight = new Map();
// Mounted hooks, told which avatar's manifest was dropped so they re-read it.
const invalidationListeners = new Set();

// A stored portrait means a new set of stills and loops: drop the manifest the
// moment the portrait job finishes, so the chat header, the message faces,
// the gallery and the Data Uploaded rows stop showing the pre-upload answer
// (an empty manifest, cached when the avatar was first opened).
subscribeAvatarPortraitChanged((assistantId) => forgetEmotionMedia(assistantId));

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
      // A failed read is not an answer. Leave the cache empty so the next
      // screen to ask retries instead of inheriting "no media" for the rest
      // of the page's life.
      console.debug('Reading emotion media failed:', loadError);
      manifestCache.delete(assistantId);
      return null;
    } finally {
      inFlight.delete(assistantId);
    }
  })();
  inFlight.set(assistantId, request);
  return request;
}

/**
 * Forget a cached manifest (after the portrait or media was regenerated).
 * Every mounted useEmotionMedia for that avatar re-reads it.
 */
export function forgetEmotionMedia(assistantId) {
  if (!assistantId) return;
  manifestCache.delete(assistantId);
  for (const listener of [...invalidationListeners]) {
    listener(assistantId);
  }
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
    // When this avatar's manifest is dropped (a portrait was stored or the
    // media regenerated), read the new one without waiting for a remount.
    const onInvalidated = (invalidatedAssistantId) => {
      if (invalidatedAssistantId !== assistantId) return;
      loadEmotionMedia(assistantId, { asAnonymousIdentity, force: true }).then(
        (loaded) => {
          if (!cancelled) setManifest(loaded);
        }
      );
    };
    invalidationListeners.add(onInvalidated);
    return () => {
      cancelled = true;
      invalidationListeners.delete(onInvalidated);
    };
  }, [assistantId, asAnonymousIdentity]);

  return { manifest, refresh };
}
