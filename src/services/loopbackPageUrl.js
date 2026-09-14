// The Vite app answers on localhost, 127.0.0.1, and ::1. Those are
// different browser origins, so the session, portraits, and carousel
// membership stored on localhost are invisible on 127.0.0.1. Avatar
// Selection then shows only Create Avatar on the loopback address.

const LOOPBACK_HOSTNAMES = new Set(['127.0.0.1', '::1', '[::1]']);

/**
 * Rewrite a loopback page URL onto localhost, keeping the port, path,
 * query, and hash. Other hosts are left alone.
 *
 * @param {string} pageUrl The address in the address bar.
 * @returns {string|null} The localhost URL, or null when no rewrite is needed.
 */
export function pageUrlOnLocalhost(pageUrl) {
  if (typeof pageUrl !== 'string' || pageUrl === '') return null;
  let parsed;
  try {
    parsed = new URL(pageUrl);
  } catch {
    return null;
  }
  if (!LOOPBACK_HOSTNAMES.has(parsed.hostname)) return null;
  parsed.hostname = 'localhost';
  return parsed.href;
}

/**
 * Send this tab from a loopback hostname to localhost so the signed-in
 * session on localhost is the one the page uses.
 *
 * @param {Pick<Location, 'href' | 'replace'>|null|undefined} pageLocation
 * @returns {boolean} True when a replace was issued.
 */
export function replaceLoopbackPageWithLocalhost(pageLocation) {
  const nextUrl = pageUrlOnLocalhost(pageLocation?.href);
  if (!nextUrl) return false;
  if (typeof pageLocation.replace !== 'function') return false;
  pageLocation.replace(nextUrl);
  return true;
}
