// src/services/youtubeVideoId.js
//
// One YouTube video has many addresses (watch?v=, youtu.be, shorts, embed,
// plus playlist and share query params). Identity media keys documents by
// URL string, so those forms would otherwise become separate uploads.

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
export const parseHttpUrl = (href) => {
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

/**
 * @param {string|URL} href A pasted address or a document label.
 * @returns {string|null}
 */
export const youtubeVideoIdFromHref = (href) => {
  const sourceUrl = href instanceof URL ? href : parseHttpUrl(href);
  return sourceUrl ? extractYouTubeVideoIdFromUrl(sourceUrl) : null;
};

/**
 * Stable watch URL for a YouTube clip. Other addresses are returned unchanged.
 *
 * @param {string} href
 * @returns {string}
 */
export const canonicalYouTubeWatchUrl = (href) => {
  const videoId = youtubeVideoIdFromHref(href);
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : String(href ?? '');
};

/**
 * Identity for duplicate detection: one key per YouTube video, otherwise the
 * URL or label as stored.
 *
 * @param {string} href
 * @returns {string}
 */
export const mediaUrlIdentityKey = (href) => {
  const videoId = youtubeVideoIdFromHref(href);
  return videoId ? `youtube:${videoId}` : String(href ?? '');
};
