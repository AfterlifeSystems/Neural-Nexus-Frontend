/**
 * Split spoken text so http(s) URLs can be painted as links.
 *
 * Avatar replies stay plain text in the bubble. When the avatar shares an
 * organization website — "You can learn more at https://grantimaharafoundation.org."
 * — the URL still has to be tappable. Markdown `[label](url)` is the other
 * form models write; treating the whole `[url](url)` span as one token made
 * `new URL` reject it and left the address as ordinary words.
 */

const MARKDOWN_LINK_PATTERN =
  /\[([^\]]+)\]\(\s*(https?:\/\/[^\s)]+)\s*\)/gi;
const BARE_HTTP_URL_PATTERN = /https?:\/\/[^\s<>"'`\]]+/gi;

function stripTrailingPunctuation(href) {
  return String(href ?? '').replace(/[.,;:!?)]+$/g, '');
}

function httpUrlFrom(raw) {
  const href = stripTrailingPunctuation(raw);
  if (!href) return null;
  try {
    const parsed = new URL(href);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return { href: parsed.href, display: href };
  } catch {
    return null;
  }
}

function pushText(parts, value) {
  if (!value) return;
  parts.push({ type: 'text', value });
}

function pushLink(parts, href, display) {
  parts.push({ type: 'link', href, display });
}

function splitBareHttpUrls(text, parts) {
  const raw = String(text ?? '');
  if (!raw) return;
  let cursor = 0;
  for (const match of raw.matchAll(BARE_HTTP_URL_PATTERN)) {
    const matched = match[0];
    const start = match.index ?? 0;
    if (start > cursor) {
      pushText(parts, raw.slice(cursor, start));
    }
    const parsed = httpUrlFrom(matched);
    if (parsed) {
      pushLink(parts, parsed.href, parsed.display);
      const trailing = matched.slice(parsed.display.length);
      if (trailing) pushText(parts, trailing);
    } else {
      pushText(parts, matched);
    }
    cursor = start + matched.length;
  }
  if (cursor < raw.length) {
    pushText(parts, raw.slice(cursor));
  }
}

/**
 * Alternate text and URL parts, in order.
 *
 * Link parts carry `href` (what the browser opens) and `display` (what the
 * person reads). Older callers that only looked at `value` still work: a
 * link's `value` is the href.
 *
 * @param {string} text Spoken bubble text.
 * @returns {Array<{type: 'text'|'link', value?: string, href?: string, display?: string}>}
 */
export function splitHttpUrlParts(text) {
  const raw = String(text ?? '');
  if (!raw) return [];
  const parts = [];
  let cursor = 0;
  for (const match of raw.matchAll(MARKDOWN_LINK_PATTERN)) {
    const start = match.index ?? 0;
    if (start > cursor) {
      splitBareHttpUrls(raw.slice(cursor, start), parts);
    }
    const label = match[1];
    const parsed = httpUrlFrom(match[2]);
    if (parsed) {
      pushLink(parts, parsed.href, label.trim() || parsed.display);
    } else {
      pushText(parts, match[0]);
    }
    cursor = start + match[0].length;
  }
  if (cursor < raw.length) {
    splitBareHttpUrls(raw.slice(cursor), parts);
  }
  return parts.map((part) =>
    part.type === 'link'
      ? { ...part, value: part.href }
      : part
  );
}
