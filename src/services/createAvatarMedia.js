// src/services/createAvatarMedia.js
//
// Classify files and addresses dropped or pasted on Create Avatar. A
// photograph becomes the portrait, audio and video become the voice
// reference, and everything else is ordinary identity media. The avatar
// does not exist yet, so nothing is uploaded here — the modal keeps the
// batch and posts it after POST /create_avatar.

import { collectIdentityLinks } from './createAvatarIdentityLinks.js';
import { parseHttpUrls } from './parseHttpUrls.js';
import { IMAGE_EXTENSIONS } from './referenceImageUrl.js';
import { parseHttpUrl } from './youtubeVideoId.js';
import {
  isVoiceMediaFile,
  isVoiceMediaUrl,
} from './voiceMedia.js';
import { mediaUrlIdentityKey } from './youtubeVideoId.js';

const extensionOf = (name) => {
  const text = String(name ?? '');
  const dot = text.lastIndexOf('.');
  if (dot < 1) return '';
  return text.slice(dot + 1).toLowerCase();
};

/**
 * @param {File|{name?: string, type?: string}|null|undefined} file
 * @returns {boolean} True for a still image, by MIME type or extension.
 */
export function isPortraitMediaFile(file) {
  const mimeType = String(file?.type ?? '');
  if (mimeType.startsWith('image/')) return true;
  if (mimeType.startsWith('audio/') || mimeType.startsWith('video/')) {
    return false;
  }
  return IMAGE_EXTENSIONS.has(extensionOf(file?.name));
}

/**
 * A pasted address is a portrait only when the path is a still image.
 * Extension-less pages (Wikipedia, a bio) stay identity sources so they
 * are not mistaken for a CDN photograph.
 *
 * @param {string} href
 * @returns {boolean}
 */
export function isCreateAvatarPortraitUrl(href) {
  const sourceUrl = parseHttpUrl(href);
  if (!sourceUrl) return false;
  if (isVoiceMediaUrl(href)) return false;
  return IMAGE_EXTENSIONS.has(extensionOf(sourceUrl.pathname));
}

/**
 * Stable identity for a browser File already held in the form.
 *
 * @param {File|{name?: string, size?: number, lastModified?: number}|null|undefined} file
 * @returns {string}
 */
export function fileIdentityKey(file) {
  return `${file?.name ?? ''}:${file?.size ?? ''}:${file?.lastModified ?? ''}`;
}

/**
 * @param {File|{name?: string, size?: number, lastModified?: number}|null|undefined} file
 * @returns {string}
 */
export function createAvatarVoiceFileKey(file) {
  return `file:${fileIdentityKey(file)}`;
}

/**
 * @param {string} url
 * @returns {string}
 */
export function createAvatarVoiceUrlKey(url) {
  return `url:${mediaUrlIdentityKey(url) || String(url ?? '').trim()}`;
}

/**
 * Which voice item is marked as the reference clip.
 *
 * `null` means none was chosen yet (the first voice item is used).
 * `''` means the creator cleared the mark on purpose.
 *
 * @param {Object} [media]
 * @returns {string|null}
 */
export function normalizeReferenceAudioKey(media = {}) {
  if (media.referenceAudioKey === '') return '';
  if (typeof media.referenceAudioKey === 'string') {
    return media.referenceAudioKey;
  }
  return null;
}

/**
 * @param {Object} [current]
 * @returns {{
 *   photoFile: File|null,
 *   photoUrl: string|null,
 *   voiceFiles: File[],
 *   voiceUrls: string[],
 *   identityFiles: File[],
 *   identityLinks: string[],
 *   referenceAudioKey: string|null,
 * }}
 */
export function emptyCreateAvatarMedia(current = {}) {
  return {
    photoFile: current.photoFile ?? null,
    photoUrl: current.photoUrl ?? null,
    voiceFiles: Array.isArray(current.voiceFiles) ? [...current.voiceFiles] : [],
    voiceUrls: Array.isArray(current.voiceUrls) ? [...current.voiceUrls] : [],
    identityFiles: Array.isArray(current.identityFiles)
      ? [...current.identityFiles]
      : [],
    identityLinks: Array.isArray(current.identityLinks)
      ? [...current.identityLinks]
      : [],
    referenceAudioKey: normalizeReferenceAudioKey(current),
  };
}

/**
 * Keep a still-present mark, or point at the first voice item when none
 * was chosen. An explicit empty mark stays empty.
 *
 * @param {Object} [media]
 * @returns {Object}
 */
export function assignDefaultReferenceAudio(media = {}) {
  const next = emptyCreateAvatarMedia(media);
  const keys = [
    ...next.voiceFiles.map((file) => createAvatarVoiceFileKey(file)),
    ...next.voiceUrls.map((url) => createAvatarVoiceUrlKey(url)),
  ];
  if (keys.length === 0) {
    next.referenceAudioKey = null;
    return next;
  }
  if (next.referenceAudioKey === '') return next;
  if (next.referenceAudioKey && keys.includes(next.referenceAudioKey)) {
    return next;
  }
  next.referenceAudioKey = keys[0];
  return next;
}

/**
 * Mark one voice item as the reference clip, or clear the mark when the
 * same item is chosen again.
 *
 * @param {Object} [media]
 * @param {string} key
 * @returns {Object}
 */
export function toggleCreateAvatarReferenceAudio(media = {}, key) {
  const current = emptyCreateAvatarMedia(media);
  current.referenceAudioKey = current.referenceAudioKey === key ? '' : key;
  return current;
}

/**
 * Split voice items into the marked reference clip and the rest.
 *
 * @param {Object} [media]
 * @returns {{
 *   referenceFile: File|null,
 *   referenceUrl: string|null,
 *   otherFiles: File[],
 *   otherUrls: string[],
 *   referenceLabel: string,
 *   referenceAudioKey: string|null,
 * }}
 */
export function splitCreateAvatarVoiceUploads(media = {}) {
  const assigned = assignDefaultReferenceAudio(media);
  const markedKey = assigned.referenceAudioKey;
  let referenceFile = null;
  let referenceUrl = null;
  const otherFiles = [];
  const otherUrls = [];
  for (const file of assigned.voiceFiles) {
    if (markedKey && createAvatarVoiceFileKey(file) === markedKey) {
      referenceFile = file;
    } else {
      otherFiles.push(file);
    }
  }
  for (const url of assigned.voiceUrls) {
    if (markedKey && createAvatarVoiceUrlKey(url) === markedKey) {
      referenceUrl = url;
    } else {
      otherUrls.push(url);
    }
  }
  return {
    referenceFile,
    referenceUrl,
    otherFiles,
    otherUrls,
    referenceLabel:
      String(referenceFile?.name ?? '').trim() ||
      String(referenceUrl ?? '').trim(),
    referenceAudioKey: markedKey,
  };
}

const appendUniqueFile = (files, incoming) => {
  const key = fileIdentityKey(incoming);
  if (!key || key === '::') return files;
  if (files.some((candidate) => fileIdentityKey(candidate) === key)) {
    return files;
  }
  return [...files, incoming];
};

const appendUniqueVoiceUrl = (urls, incoming) => {
  const key = mediaUrlIdentityKey(incoming);
  if (!key) return urls;
  if (urls.some((candidate) => mediaUrlIdentityKey(candidate) === key)) {
    return urls;
  }
  return [...urls, incoming];
};

/**
 * Files and http(s) addresses from a drop or a file-input change.
 *
 * @param {DataTransfer|{files?: FileList|File[], getData?: Function}|null|undefined} dataTransfer
 * @returns {{files: File[], urls: string[]}}
 */
export function createAvatarMediaFromDataTransfer(dataTransfer) {
  const files = Array.from(dataTransfer?.files ?? []);
  const text =
    typeof dataTransfer?.getData === 'function'
      ? dataTransfer.getData('text/uri-list') ||
        dataTransfer.getData('text/plain') ||
        ''
      : '';
  return { files, urls: parseHttpUrls(text) };
}

/**
 * Fold a dropped or pasted batch into the create form. A new photograph
 * replaces the previous portrait. Voice and identity items accumulate and
 * skip duplicates.
 *
 * @param {Object} [current]
 * @param {{files?: File[], urls?: string[]}} [incoming]
 * @returns {{
 *   photoFile: File|null,
 *   photoUrl: string|null,
 *   voiceFiles: File[],
 *   voiceUrls: string[],
 *   identityFiles: File[],
 *   identityLinks: string[],
 *   photoReplaced: boolean,
 *   addedPortrait: number,
 *   addedVoice: number,
 *   addedIdentity: number,
 * }}
 */
export function applyCreateAvatarMedia(current = {}, incoming = {}) {
  const next = emptyCreateAvatarMedia(current);
  const files = Array.isArray(incoming.files) ? incoming.files : [];
  const urls = Array.isArray(incoming.urls) ? incoming.urls : [];
  let photoReplaced = false;
  let addedPortrait = 0;
  let addedVoice = 0;
  let addedIdentity = 0;

  for (const file of files) {
    if (!file) continue;
    if (isVoiceMediaFile(file)) {
      const before = next.voiceFiles.length;
      next.voiceFiles = appendUniqueFile(next.voiceFiles, file);
      addedVoice += next.voiceFiles.length - before;
      continue;
    }
    if (isPortraitMediaFile(file)) {
      next.photoFile = file;
      next.photoUrl = null;
      photoReplaced = true;
      addedPortrait += 1;
      continue;
    }
    const before = next.identityFiles.length;
    next.identityFiles = appendUniqueFile(next.identityFiles, file);
    addedIdentity += next.identityFiles.length - before;
  }

  for (const url of urls) {
    if (isVoiceMediaUrl(url)) {
      const before = next.voiceUrls.length;
      next.voiceUrls = appendUniqueVoiceUrl(next.voiceUrls, url);
      addedVoice += next.voiceUrls.length - before;
      continue;
    }
    if (isCreateAvatarPortraitUrl(url)) {
      next.photoFile = null;
      next.photoUrl = url;
      photoReplaced = true;
      addedPortrait += 1;
      continue;
    }
    const merged = collectIdentityLinks(next.identityLinks, url);
    addedIdentity += merged.length - next.identityLinks.length;
    next.identityLinks = merged;
  }

  return {
    ...assignDefaultReferenceAudio(next),
    photoReplaced,
    addedPortrait,
    addedVoice,
    addedIdentity,
  };
}

/**
 * Drain a typed or pasted address field. An empty draft is fine. Leftover
 * text that is not a URL blocks create so the field is not silently dropped.
 *
 * @param {Object} current
 * @param {string} draftText
 * @returns {{media: Object, leftover: string, error: string}}
 */
export function takeCreateAvatarMediaDraft(current, draftText) {
  const trimmed = String(draftText ?? '').trim();
  if (!trimmed) {
    return {
      media: assignDefaultReferenceAudio(current),
      leftover: '',
      error: '',
    };
  }
  const urls = parseHttpUrls(trimmed);
  if (urls.length === 0) {
    return {
      media: assignDefaultReferenceAudio(current),
      leftover: trimmed,
      error: 'Enter an http:// or https:// address, or clear the field.',
    };
  }
  return {
    media: applyCreateAvatarMedia(current, { urls }),
    leftover: '',
    error: '',
  };
}

/**
 * Research hint naming the voice samples the creator already has.
 *
 * @param {{files?: Array<{name?: string}>, urls?: string[]}} [sources]
 * @returns {string}
 */
export function researchHintFromVoiceSources({
  files = [],
  urls = [],
  referenceAudioKey = null,
} = {}) {
  const split = splitCreateAvatarVoiceUploads({
    voiceFiles: files,
    voiceUrls: urls,
    referenceAudioKey,
  });
  if (split.referenceLabel) {
    return `Reference audio was given for the voice: ${split.referenceLabel}.`;
  }
  const names = [
    ...files.map((file) => String(file?.name ?? '').trim()).filter(Boolean),
    ...urls.map((url) => String(url ?? '').trim()).filter(Boolean),
  ];
  if (names.length === 0) return '';
  return `Voice media was given: ${names.join(', ')}.`;
}

/**
 * Whether anything collected here should be posted after the avatar exists.
 *
 * @param {Object} [media]
 * @returns {boolean}
 */
export function hasCreateAvatarFollowUpMedia(media = {}) {
  return Boolean(
    media.photoFile ||
      String(media.photoUrl ?? '').trim() ||
      (media.voiceFiles?.length ?? 0) > 0 ||
      (media.voiceUrls?.length ?? 0) > 0 ||
      (media.identityFiles?.length ?? 0) > 0 ||
      (media.identityLinks?.length ?? 0) > 0
  );
}
