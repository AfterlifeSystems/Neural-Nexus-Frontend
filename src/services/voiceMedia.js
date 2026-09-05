// src/services/voiceMedia.js
//
// What counts as speech of the avatar. Audio and video files, and YouTube or
// direct audio/video URLs, are "voice media": the identity-media job stores
// the first one as the reference clip, adds the avatar's speech to the voice
// corpus, and indexes the transcript — from the Voice section and the Upload
// section alike. Everything else is an ordinary document.

import {
  AUDIO_EXTENSIONS,
  VIDEO_EXTENSIONS,
  looksLikeReferenceAudioUrl,
} from './referenceAudioUrl.js';

const extensionOf = (name) => {
  const text = String(name ?? '');
  const dot = text.lastIndexOf('.');
  if (dot < 1) return '';
  return text.slice(dot + 1).toLowerCase();
};

/**
 * @param {string} filename A file name or path.
 * @returns {boolean} True for audio/video file extensions.
 */
export const isVoiceMediaFilename = (filename) => {
  const extension = extensionOf(filename);
  return AUDIO_EXTENSIONS.has(extension) || VIDEO_EXTENSIONS.has(extension);
};

/**
 * @param {File|{name?: string, type?: string}} file A browser File.
 * @returns {boolean} True when the file is audio or video, by MIME type or
 *   by extension when the browser reports no type.
 */
export const isVoiceMediaFile = (file) => {
  const mimeType = String(file?.type ?? '');
  if (mimeType.startsWith('audio/') || mimeType.startsWith('video/')) {
    return true;
  }
  if (mimeType) return false;
  return isVoiceMediaFilename(file?.name);
};

/**
 * @param {string} url An http(s) address.
 * @returns {boolean} True for YouTube links and direct audio/video URLs.
 */
export const isVoiceMediaUrl = (url) => looksLikeReferenceAudioUrl(url);

/**
 * Split a mixed upload batch into voice media and ordinary documents.
 *
 * @param {{files?: File[], urls?: string[]}} batch
 * @returns {{voiceFiles: File[], voiceUrls: string[], otherFiles: File[], otherUrls: string[]}}
 */
export const splitVoiceMedia = ({ files = [], urls = [] } = {}) => {
  const voiceFiles = [];
  const otherFiles = [];
  for (const file of files) {
    (isVoiceMediaFile(file) ? voiceFiles : otherFiles).push(file);
  }
  const voiceUrls = [];
  const otherUrls = [];
  for (const url of urls) {
    (isVoiceMediaUrl(url) ? voiceUrls : otherUrls).push(url);
  }
  return { voiceFiles, voiceUrls, otherFiles, otherUrls };
};
