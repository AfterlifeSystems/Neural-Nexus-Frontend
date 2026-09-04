// src/services/parseHttpUrls.js
//
// Pull http(s) URLs out of pasted or typed text. A single field can carry
// several, separated by whitespace, commas, or newlines (including a
// text/uri-list drop, whose comment lines start with #).

/**
 * @param {string} text Raw clipboard, input, or uri-list text.
 * @returns {string[]} Unique absolute http(s) URLs, in order of appearance.
 */
export function parseHttpUrls(text) {
  if (typeof text !== 'string' || !text.trim()) return [];

  const tokens = text
    .split(/[\r\n]+/)
    .flatMap((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return [];
      return trimmed.split(/[\s,;]+/);
    })
    .map((token) => token.trim())
    .filter(Boolean);

  const urls = [];
  const seen = new Set();
  for (const token of tokens) {
    let href;
    try {
      const parsed = new URL(token);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue;
      href = parsed.href;
    } catch {
      continue;
    }
    if (seen.has(href)) continue;
    seen.add(href);
    urls.push(href);
  }
  return urls;
}
