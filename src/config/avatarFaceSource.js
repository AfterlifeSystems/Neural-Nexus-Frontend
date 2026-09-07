// src/config/avatarFaceSource.js
//
// Whether an avatar's voice stage, chat faces, and carousel card show
// generated emotion stills and idle loops, or the original reference photo.
// Each avatar has its own choice so one can stay on the uploaded portrait
// while another uses the generated set.

export const AVATAR_FACE_SOURCE_GENERATED = 'generated';
export const AVATAR_FACE_SOURCE_REFERENCE = 'reference';

const STORAGE_KEY = 'avatar_face_source';
const listeners = new Set();

/**
 * @param {unknown} value
 * @returns {'generated'|'reference'}
 */
export function normalizeAvatarFaceSource(value) {
  return value === AVATAR_FACE_SOURCE_REFERENCE
    ? AVATAR_FACE_SOURCE_REFERENCE
    : AVATAR_FACE_SOURCE_GENERATED;
}

/**
 * @param {unknown} [storage]
 * @returns {Storage|null}
 */
function storageOf(storage) {
  if (storage === undefined) return globalThis.localStorage ?? null;
  return storage ?? null;
}

function assistantIdOf(assistantId) {
  return typeof assistantId === 'string' ? assistantId.trim() : '';
}

/**
 * The stored map plus the default for avatars that have not been set.
 *
 * The first version of this preference was a single `'generated'` /
 * `'reference'` string for every avatar. That string is still honoured as the
 * default so a browser that already chose the original photo does not flip
 * every card the first time one avatar is saved on its own.
 *
 * @param {Storage|null|undefined} [storage]
 * @returns {{defaultSource: 'generated'|'reference', byId: Record<string, string>}}
 */
export function readAvatarFaceSourceStore(storage) {
  try {
    const raw = storageOf(storage)?.getItem(STORAGE_KEY);
    if (!raw) {
      return { defaultSource: AVATAR_FACE_SOURCE_GENERATED, byId: {} };
    }
    if (
      raw === AVATAR_FACE_SOURCE_REFERENCE ||
      raw === AVATAR_FACE_SOURCE_GENERATED
    ) {
      return { defaultSource: raw, byId: {} };
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { defaultSource: AVATAR_FACE_SOURCE_GENERATED, byId: {} };
    }
    if (parsed.byId && typeof parsed.byId === 'object' && !Array.isArray(parsed.byId)) {
      return {
        defaultSource: normalizeAvatarFaceSource(parsed.defaultSource),
        byId: parsed.byId,
      };
    }
    return {
      defaultSource: AVATAR_FACE_SOURCE_GENERATED,
      byId: parsed,
    };
  } catch {
    return { defaultSource: AVATAR_FACE_SOURCE_GENERATED, byId: {} };
  }
}

/**
 * @param {string|null|undefined} assistantId
 * @param {Storage|null|undefined} [storage]
 * @returns {'generated'|'reference'}
 */
export function readAvatarFaceSource(assistantId, storage) {
  const { defaultSource, byId } = readAvatarFaceSourceStore(storage);
  const id = assistantIdOf(assistantId);
  if (id && byId[id]) return normalizeAvatarFaceSource(byId[id]);
  return normalizeAvatarFaceSource(defaultSource);
}

/**
 * @param {string|null|undefined} assistantId
 * @param {Storage|null|undefined} [storage]
 * @returns {boolean}
 */
export function showsGeneratedFace(assistantId, storage) {
  return readAvatarFaceSource(assistantId, storage) === AVATAR_FACE_SOURCE_GENERATED;
}

/**
 * @param {string|null|undefined} assistantId
 * @param {'generated'|'reference'} source
 * @param {Storage|null|undefined} [storage]
 * @returns {'generated'|'reference'}
 */
export function writeAvatarFaceSource(assistantId, source, storage) {
  const next = normalizeAvatarFaceSource(source);
  const id = assistantIdOf(assistantId);
  if (!id) return next;
  const store = storageOf(storage);
  const current = readAvatarFaceSourceStore(store);
  const nextStore = {
    defaultSource: current.defaultSource,
    byId: { ...current.byId, [id]: next },
  };
  try {
    store?.setItem(STORAGE_KEY, JSON.stringify(nextStore));
  } catch {
    // Private mode / quota: the choice then lasts only for this page.
  }
  for (const listener of listeners) listener(id, next);
  return next;
}

/**
 * @param {Function} listener Called with `(assistantId, source)` after a write.
 * @returns {Function} Unsubscribe.
 */
export function subscribeAvatarFaceSource(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * The still and idle loop the voice stage should paint.
 *
 * @param {Object} options
 * @param {boolean} options.showGenerated Use generated emotion media.
 * @param {string|null} [options.generatedStill]
 * @param {string|null} [options.generatedLoop]
 * @param {string|null} [options.referenceStill] The original reference photo.
 * @returns {{still: string|null, loop: string|null}}
 */
export function voiceStageFace({
  showGenerated,
  generatedStill = null,
  generatedLoop = null,
  referenceStill = null,
}) {
  if (!showGenerated) {
    return { still: referenceStill ?? null, loop: null };
  }
  return {
    still: generatedStill ?? referenceStill ?? null,
    loop: generatedLoop ?? null,
  };
}

/**
 * The carousel idle loop, or none when the original photo is showing.
 *
 * @param {string|null|undefined} loopUrl
 * @param {boolean} showGenerated
 * @returns {string|null}
 */
export function galleryIdleLoopUrl(loopUrl, showGenerated) {
  return showGenerated ? loopUrl ?? null : null;
}
