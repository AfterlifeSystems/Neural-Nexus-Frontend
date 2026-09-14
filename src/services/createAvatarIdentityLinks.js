// src/services/createAvatarIdentityLinks.js
//
// Optional identity-source links on Create Avatar. Zero or more http(s)
// addresses are collected in the form, then posted to
// /update_avatar_identity_with_media after the avatar exists. The same
// parser Settings uses (parseHttpUrls) splits a pasted list and collapses
// YouTube watch/share/short forms of one video to a single address.

import { parseHttpUrls } from './parseHttpUrls.js';
import { mediaUrlIdentityKey } from './youtubeVideoId.js';

/**
 * Merge already-accepted links with newly typed or pasted text. Order is
 * kept; YouTube variants of the same video collapse to the first form.
 *
 * @param {string[]} [existingLinks]
 * @param {string} [incomingText]
 * @returns {string[]}
 */
export function collectIdentityLinks(existingLinks = [], incomingText = '') {
  const existing = Array.isArray(existingLinks)
    ? existingLinks.filter(Boolean)
    : [];
  const incoming = parseHttpUrls(incomingText);
  const seen = new Set();
  const next = [];
  for (const url of [...existing, ...incoming]) {
    const key = mediaUrlIdentityKey(url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    next.push(url);
  }
  return next;
}

/**
 * Add from the draft field. An empty or non-URL draft is an error: the
 * creator pressed Add, so they meant to keep something.
 *
 * @param {string[]} existingLinks
 * @param {string} draftText
 * @returns {{links: string[], leftover: string, error: string}}
 */
export function addIdentityLinkDraft(existingLinks, draftText) {
  const trimmed = String(draftText ?? '').trim();
  if (!trimmed) {
    return {
      links: existingLinks,
      leftover: '',
      error: 'Enter an http:// or https:// address.',
    };
  }
  const parsed = parseHttpUrls(trimmed);
  if (parsed.length === 0) {
    return {
      links: existingLinks,
      leftover: trimmed,
      error: 'Enter an http:// or https:// address.',
    };
  }
  return {
    links: collectIdentityLinks(existingLinks, trimmed),
    leftover: '',
    error: '',
  };
}

/**
 * Drain the draft on Create. An empty draft is fine (zero extra links).
 * Leftover text that is not a URL blocks create so the field is not silently
 * dropped.
 *
 * @param {string[]} existingLinks
 * @param {string} draftText
 * @returns {{links: string[], leftover: string, error: string}}
 */
export function takeIdentityLinkDraft(existingLinks, draftText) {
  const trimmed = String(draftText ?? '').trim();
  if (!trimmed) {
    return { links: collectIdentityLinks(existingLinks, ''), leftover: '', error: '' };
  }
  const parsed = parseHttpUrls(trimmed);
  if (parsed.length === 0) {
    return {
      links: existingLinks,
      leftover: trimmed,
      error: 'Enter an http:// or https:// address, or clear the field.',
    };
  }
  return {
    links: collectIdentityLinks(existingLinks, trimmed),
    leftover: '',
    error: '',
  };
}

/**
 * Research hint naming the identity-source links the creator already has.
 *
 * @param {string[]} [urls]
 * @returns {string}
 */
export function researchHintFromIdentityLinks(urls = []) {
  const unique = collectIdentityLinks([], (urls ?? []).join('\n'));
  if (unique.length === 0) return '';
  if (unique.length === 1) {
    return `An identity source link was given: ${unique[0]}.`;
  }
  return `Identity source links were given: ${unique.join(', ')}.`;
}

/**
 * Append identity-link and voice-reference sentences to the photograph
 * research hint.
 *
 * @param {string} [photoHint]
 * @param {string[]} [identityUrls]
 * @param {string} [voiceHint]
 * @returns {string}
 */
export function composeCreateAvatarResearchHint(
  photoHint = '',
  identityUrls = [],
  voiceHint = ''
) {
  const linksHint = researchHintFromIdentityLinks(identityUrls);
  return [String(photoHint ?? '').trim(), linksHint, String(voiceHint ?? '').trim()]
    .filter(Boolean)
    .join(' ');
}

/**
 * Extra identity URLs for the post-create ingest. The photograph address and
 * any voice-reference address are already sent on their own jobs, so the
 * same (or YouTube-equivalent) link is dropped here.
 *
 * @param {string[]} [identityUrls]
 * @param {string} [photoUrl]
 * @param {string[]} [voiceUrls]
 * @returns {string[]}
 */
export function identityUrlsForUpload(
  identityUrls = [],
  photoUrl = '',
  voiceUrls = []
) {
  const extra = collectIdentityLinks([], (identityUrls ?? []).join('\n'));
  const skipKeys = new Set(
    [
      ...parseHttpUrls(String(photoUrl ?? '').trim()),
      ...(Array.isArray(voiceUrls) ? voiceUrls : []),
    ]
      .flatMap((url) => parseHttpUrls(String(url ?? '').trim()))
      .map((url) => mediaUrlIdentityKey(url))
      .filter(Boolean)
  );
  if (skipKeys.size === 0) return extra;
  return extra.filter((url) => !skipKeys.has(mediaUrlIdentityKey(url)));
}
