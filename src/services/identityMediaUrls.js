// src/services/identityMediaUrls.js
//
// YouTube watch, share, and short links are the same clip. Identity media
// keys a document by its URL string, so a second form of the same video
// would create a second row. Resolve incoming URLs onto the first stored
// label (so the existing document is the one the job updates) and collapse
// already-listed duplicates onto that first row.

import {
  canonicalYouTubeWatchUrl,
  mediaUrlIdentityKey,
} from './youtubeVideoId.js';

/**
 * Map a batch of pasted URLs onto existing document labels when they are
 * the same YouTube video, canonicalise new YouTube addresses, and drop
 * repeats.
 *
 * @param {string[]} urls
 * @param {Array<{label?: string}>} [existingDocuments]
 * @returns {string[]}
 */
export const resolveIdentityMediaUrls = (urls, existingDocuments = []) => {
  const existingByKey = new Map();
  for (const documentEntry of existingDocuments) {
    const label = documentEntry?.label;
    if (!label) continue;
    const key = mediaUrlIdentityKey(label);
    if (!key || existingByKey.has(key)) continue;
    existingByKey.set(key, label);
  }

  const seen = new Set();
  const resolved = [];
  for (const url of urls) {
    if (!url) continue;
    const key = mediaUrlIdentityKey(url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    resolved.push(existingByKey.get(key) ?? canonicalYouTubeWatchUrl(url));
  }
  return resolved;
};

/**
 * One list row per YouTube video (or per exact label otherwise). The first
 * document keeps its label; later copies of the same video contribute their
 * reference and voice-corpus marks so the row still shows what was learned.
 *
 * @param {Array<Object>} documents
 * @returns {Array<Object>}
 */
export const collapseDuplicateIdentityDocuments = (documents) => {
  if (!Array.isArray(documents)) return [];

  const groups = [];
  const indexByKey = new Map();
  for (const documentEntry of documents) {
    const label = documentEntry?.label;
    if (!label) continue;
    const key = mediaUrlIdentityKey(label);
    if (indexByKey.has(key)) {
      groups[indexByKey.get(key)].push(documentEntry);
      continue;
    }
    indexByKey.set(key, groups.length);
    groups.push([documentEntry]);
  }

  return groups.map((group) => {
    if (group.length === 1) return group[0];
    const keeper = { ...group[0] };
    keeper.sourceLabels = group.map((entry) => entry.label);
    keeper.isReferenceAudio = group.some((entry) => entry.isReferenceAudio);
    keeper.isReferenceImage = group.some((entry) => entry.isReferenceImage);
    keeper.isReferenceMedia = group.some((entry) => entry.isReferenceMedia);
    if (keeper.isReferenceAudio) {
      keeper.referenceRole = 'reference_audio';
    } else if (keeper.isReferenceImage) {
      keeper.referenceRole = 'reference_image';
    }
    keeper.inVoiceCorpus = group.some((entry) => entry.inVoiceCorpus);
    keeper.voiceSeconds = Math.max(
      ...group.map((entry) => Number(entry.voiceSeconds ?? 0) || 0)
    );
    return keeper;
  });
};
