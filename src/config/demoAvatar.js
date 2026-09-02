// src/config/demoAvatar.js
//
// Configuration for the single public demo avatar embedded on the landing page.
// The demo is this application's own anonymous shared-avatar page — the same
// screen anyone reaches by following a share link, e.g.
// https://www.neuralnexus.site/share/47cfdaa2-1196-4519-9127-31cb13ff9d3a —
// rendered inside an iframe by src/components/Landing/LiveAvatarDemo.jsx.

// Where the shared-avatar page is served from. Empty means "this same origin",
// which is what production wants: the deployed site frames its own /share page,
// and a development server frames the copy running in front of the developer.
// Set VITE_DEMO_SHARE_BASE_URL to an absolute origin (no trailing path) only to
// point the demo at a different deployment than the one serving the page.
export const DEMO_SHARE_BASE_URL =
  import.meta.env.VITE_DEMO_SHARE_BASE_URL ?? '';

export const DEMO_ASSISTANT_ID =
  import.meta.env.VITE_DEMO_ASSISTANT_ID ??
  '47cfdaa2-1196-4519-9127-31cb13ff9d3a';

/**
 * Build the address of the anonymous shared-avatar page for one assistant.
 *
 * The page needs no credential and no query parameters: the API resolves an
 * anonymous identity for any caller with none, so a visitor lands in a fresh
 * conversation with the avatar. The same address serves both the iframe and the
 * "open in a new tab" link, because the shared page is a real, linkable screen
 * rather than an embed-only view.
 *
 * @param {string} assistantIdentifier The assistant to converse with.
 * @returns {string} An absolute URL when DEMO_SHARE_BASE_URL names an origin,
 *   otherwise a root-relative path resolved against the current origin.
 */
export function buildSharedAvatarDemoUrl(
  assistantIdentifier = DEMO_ASSISTANT_ID
) {
  const sharePath = `/share/${assistantIdentifier}`;
  if (!DEMO_SHARE_BASE_URL) return sharePath;
  return `${DEMO_SHARE_BASE_URL.replace(/\/+$/, '')}${sharePath}`;
}
