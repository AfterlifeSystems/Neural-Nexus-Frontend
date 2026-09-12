/**
 * Public organization websites on an avatar record, for opening chips.
 *
 * A foundation, restaurant, or recruiting office often carries its site in
 * the description. Those URLs belong in the harvest so a visitor can ask
 * the avatar to share the link. Video and social hosts stay out — those
 * are media sources, not an organization page to hand over.
 */

import { avatarDescriptionOf } from './avatarMapMark.js';

const ORGANIZATION_LINK_PATTERN = /https?:\/\/[^\s<>"'`]+/gi;

const MEDIA_SOURCE_HOST_SUFFIXES = [
  'youtube.com',
  'youtu.be',
  'twitter.com',
  'x.com',
  'instagram.com',
  'tiktok.com',
  'facebook.com',
  'fb.com',
];

function stripTrailingPunctuation(href) {
  return String(href ?? '').replace(/[.,;:!?)\]]+$/g, '');
}

function hostnameOf(href) {
  try {
    return new URL(href).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export function isMediaSourceHost(host) {
  const hostname = String(host ?? '')
    .toLowerCase()
    .replace(/^www\./, '');
  return MEDIA_SOURCE_HOST_SUFFIXES.some(
    (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`)
  );
}

export function normalizeOrganizationLink(url) {
  const raw = stripTrailingPunctuation(String(url ?? '').trim());
  if (!raw) return null;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }
  if (isMediaSourceHost(parsed.hostname)) {
    return null;
  }
  return parsed.href;
}

/**
 * Unique organization URLs in appearance order from free text.
 *
 * @param {string|null|undefined} text Description or harvest excerpt.
 * @returns {string[]}
 */
export function organizationLinksFromText(text) {
  const found = [];
  const seen = new Set();
  const raw = String(text ?? '');
  for (const match of raw.matchAll(ORGANIZATION_LINK_PATTERN)) {
    const href = normalizeOrganizationLink(match[0]);
    if (!href || seen.has(href)) continue;
    seen.add(href);
    found.push(href);
  }
  return found;
}

/**
 * Organization URLs the open avatar can share, from name-adjacent identity text.
 *
 * @param {Object|null|undefined} avatar The open avatar.
 * @returns {string[]}
 */
export function organizationLinksFromAvatar(avatar) {
  return organizationLinksFromText(avatarDescriptionOf(avatar));
}

/**
 * Hostname helper for tests and labels.
 *
 * @param {string} href
 * @returns {string}
 */
export function organizationLinkHostname(href) {
  return hostnameOf(href).replace(/^www\./, '');
}
