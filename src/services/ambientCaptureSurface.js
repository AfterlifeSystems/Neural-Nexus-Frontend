// Where ambient vision may send a snapshot. Webcam and screen stay live
// everywhere the signed-in sidebar is; observations only go out on the
// conversation itself — the message view or voice mode — never the gallery,
// settings, inbox, or billing.

const CHAT_PATH = /^\/chat\/[^/]+$/;

/**
 * Whether this location is a conversation surface.
 *
 * `/chat/:id` with no tab, or with the chat tab, is. Settings and inbox share
 * that path and are not. Voice mode is the same chat route.
 *
 * @param {string} [pathname]
 * @param {string} [search] `location.search`, with or without the leading `?`.
 * @returns {boolean}
 */
export function isAmbientCaptureSurface(pathname, search = '') {
  if (!CHAT_PATH.test(pathname ?? '')) {
    return false;
  }
  const query = String(search ?? '');
  const params = new URLSearchParams(
    query.startsWith('?') ? query.slice(1) : query
  );
  const tab = params.get('tab');
  return tab !== 'settings' && tab !== 'inbox';
}
