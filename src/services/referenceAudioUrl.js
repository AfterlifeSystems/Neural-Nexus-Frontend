// src/services/referenceAudioUrl.js
//
// Decide whether a pasted address can be the avatar's voice reference.
// The identity-media API accepts one URL with reference_audio=true: a
// YouTube watch/shorts link (audio pulled via yt_dlp) or a direct
// audio/video file. Playlists and articles are identity sources, not a
// single speaker clip.

import { parseHttpUrls } from './parseHttpUrls.js';

export const AUDIO_EXTENSIONS = new Set([
  'mp3',
  'wav',
  'm4a',
  'aac',
  'ogg',
  'oga',
  'flac',
  'wma',
  'opus',
  'aiff',
  'amr',
]);

export const VIDEO_EXTENSIONS = new Set([
  'mp4',
  'mov',
  'avi',
  'mkv',
  'webm',
  'wmv',
  'flv',
  'm4v',
  'mpg',
  'mpeg',
]);

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'youtu.be',
]);

const YOUTUBE_VIDEO_ID = /^[\w-]{11}$/;

/**
 * @param {string} href Absolute http(s) URL.
 * @returns {URL|null}
 */
const parseHttpUrl = (href) => {
  try {
    const parsed = new URL(href);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? parsed
      : null;
  } catch {
    return null;
  }
};

/**
 * Pull the video identifier out of a YouTube address. Playlists with no
 * `v=` are not a single clip.
 *
 * @param {URL} sourceUrl
 * @returns {string|null}
 */
export const extractYouTubeVideoIdFromUrl = (sourceUrl) => {
  if (!(sourceUrl instanceof URL)) return null;
  const host = sourceUrl.hostname.replace(/^www\./i, '').toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) return null;

  if (host === 'youtu.be') {
    const identifier = sourceUrl.pathname.split('/').filter(Boolean)[0];
    return YOUTUBE_VIDEO_ID.test(identifier ?? '') ? identifier : null;
  }

  const watchIdentifier = sourceUrl.searchParams.get('v');
  if (YOUTUBE_VIDEO_ID.test(watchIdentifier ?? '')) {
    return watchIdentifier;
  }

  const [pathPrefix, pathIdentifier] = sourceUrl.pathname
    .split('/')
    .filter(Boolean);
  if (
    ['shorts', 'live', 'embed', 'v'].includes(pathPrefix) &&
    YOUTUBE_VIDEO_ID.test(pathIdentifier ?? '')
  ) {
    return pathIdentifier;
  }
  return null;
};

const extensionFromPath = (pathname) => {
  const lastSegment = (pathname ?? '').split('/').pop() ?? '';
  const dot = lastSegment.lastIndexOf('.');
  if (dot < 1) return '';
  return lastSegment.slice(dot + 1).toLowerCase();
};

/**
 * @param {string} href Candidate address.
 * @returns {boolean} True when this URL can be sent as reference_audio.
 */
export const looksLikeReferenceAudioUrl = (href) => {
  const sourceUrl = parseHttpUrl(href);
  if (!sourceUrl) return false;
  if (extractYouTubeVideoIdFromUrl(sourceUrl)) return true;
  const extension = extensionFromPath(sourceUrl.pathname);
  return AUDIO_EXTENSIONS.has(extension) || VIDEO_EXTENSIONS.has(extension);
};

/**
 * One voice-media URL from pasted or typed text: a YouTube link or a direct
 * audio/video address. The voice panel starts one job per URL.
 *
 * @param {string} text Raw clipboard or input text.
 * @returns {{ url: string } | { error: string }}
 */
export const singleReferenceAudioUrl = (text) => {
  const urls = parseHttpUrls(text);
  if (urls.length === 0) {
    return { error: 'Enter an http:// or https:// video or audio URL' };
  }
  if (urls.length > 1) {
    return { error: 'Add one voice URL at a time' };
  }
  if (!looksLikeReferenceAudioUrl(urls[0])) {
    return {
      error:
        'Only a YouTube link or a direct audio/video URL can be added to the voice',
    };
  }
  return { url: urls[0] };
};
