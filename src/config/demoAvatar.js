// src/config/demoAvatar.js
//
// Configuration for the single public demo avatar embedded on the landing page.
// The demo is served by the Neural Nexus Streamlit application, which is embedded
// in an iframe by src/components/Landing/LiveAvatarDemo.jsx.

export const STREAMLIT_EMBED_BASE_URL =
  import.meta.env.VITE_STREAMLIT_EMBED_URL ??
  'https://neural-nexus-ui.streamlit.app';

export const DEMO_ASSISTANT_ID =
  import.meta.env.VITE_DEMO_ASSISTANT_ID ??
  '47cfdaa2-1196-4519-9127-31cb13ff9d3a';

/**
 * Build the embeddable Streamlit URL for one assistant.
 *
 * `embed=true` is required, not cosmetic: without that parameter Streamlit
 * Community Cloud runs a session handshake that sets `SameSite=Lax` cookies.
 * Those cookies are never sent inside a cross-site iframe, so the handshake
 * redirect-loops forever. With `embed=true` the application responds `200`
 * directly and skips the handshake.
 *
 * No `api_key` parameter is passed. When the Streamlit application sees no
 * `api_key`, it takes its anonymous branch: it opens a fresh conversation and
 * posts the automatic greeting, so a visitor sees messages without clicking.
 *
 * @param {string} assistantIdentifier The assistant to converse with.
 * @returns {string} A URL suitable for an iframe `src`.
 */
export function buildStreamlitEmbedUrl(assistantIdentifier = DEMO_ASSISTANT_ID) {
  const embedUrl = new URL(STREAMLIT_EMBED_BASE_URL);
  embedUrl.searchParams.set('assistant_id', assistantIdentifier);
  embedUrl.searchParams.set('embed', 'true');
  embedUrl.searchParams.set('embed_options', 'dark_theme');
  // Streamlit's own boot screen is light, so it flashes as a white panel while a
  // sleeping app wakes — several seconds on Community Cloud. Suppressing it lets
  // the dark overlay in LiveAvatarDemo cover that window instead.
  embedUrl.searchParams.append('embed_options', 'hide_loading_screen');
  return embedUrl.toString();
}

/**
 * Build the standalone Streamlit URL — the same assistant with the full
 * Streamlit chrome. Used for the "open in a new tab" escape hatch shown when a
 * browser or extension blocks third-party frames.
 *
 * @param {string} assistantIdentifier The assistant to converse with.
 * @returns {string} A URL suitable for a normal link.
 */
export function buildStreamlitStandaloneUrl(
  assistantIdentifier = DEMO_ASSISTANT_ID
) {
  const standaloneUrl = new URL(STREAMLIT_EMBED_BASE_URL);
  standaloneUrl.searchParams.set('assistant_id', assistantIdentifier);
  return standaloneUrl.toString();
}
