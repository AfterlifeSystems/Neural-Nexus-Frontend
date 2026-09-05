// src/services/referenceImageUrl.js
//
// Decide whether a pasted address can be the avatar's reference image
// (the portrait). The identity-media API accepts one URL with
// reference_image=true: a direct image file, or an extension-less CDN
// address that still serves an image. Voice media and ordinary documents
// belong elsewhere.

import { parseHttpUrls } from './parseHttpUrls.js';
import { looksLikeReferenceAudioUrl } from './referenceAudioUrl.js';

export const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'bmp',
  'avif',
  'svg',
  'ico',
  'tif',
  'tiff',
  'heic',
  'heif',
  'jfif',
]);

const DOCUMENT_EXTENSIONS = new Set([
  'pdf',
  'html',
  'htm',
  'txt',
  'md',
  'doc',
  'docx',
  'rtf',
  'csv',
  'json',
  'xml',
  'zip',
  'gz',
  'tar',
]);

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

const extensionFromPath = (pathname) => {
  const lastSegment = (pathname ?? '').split('/').pop() ?? '';
  const dot = lastSegment.lastIndexOf('.');
  if (dot < 1) return '';
  return lastSegment.slice(dot + 1).toLowerCase();
};

/**
 * @param {string} href Candidate address.
 * @returns {boolean} True when this URL can be sent as reference_image.
 */
export const looksLikeReferenceImageUrl = (href) => {
  const sourceUrl = parseHttpUrl(href);
  if (!sourceUrl) return false;
  if (looksLikeReferenceAudioUrl(href)) return false;
  const extension = extensionFromPath(sourceUrl.pathname);
  if (IMAGE_EXTENSIONS.has(extension)) return true;
  if (DOCUMENT_EXTENSIONS.has(extension)) return false;
  // Extension-less addresses are often CDN portraits: GitHub avatars,
  // Unsplash, signed storage URLs. The server decides whether the bytes
  // are an image.
  return !extension;
};

/**
 * One portrait URL from pasted or typed text. The portrait control starts
 * one job per URL.
 *
 * @param {string} text Raw clipboard or input text.
 * @returns {{ url: string } | { error: string }}
 */
export const singleReferenceImageUrl = (text) => {
  const urls = parseHttpUrls(text);
  if (urls.length === 0) {
    return { error: 'Enter an http:// or https:// image URL' };
  }
  if (urls.length > 1) {
    return { error: 'Add one portrait URL at a time' };
  }
  if (looksLikeReferenceAudioUrl(urls[0])) {
    return {
      error:
        'That address is audio or video. Add it under Voice, not as the portrait.',
    };
  }
  if (!looksLikeReferenceImageUrl(urls[0])) {
    return {
      error:
        'Only a direct image URL can be the portrait — a .jpg, .png, .webp, or an image CDN link',
    };
  }
  return { url: urls[0] };
};
