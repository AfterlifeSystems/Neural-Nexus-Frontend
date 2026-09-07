// src/components/connections/connectorFormStyles.js
//
// The classes the custom connector forms share, kept out of the component
// files so each of those exports only a component (fast refresh).

export const CONNECTOR_INPUT_CLASSES =
  'w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-lg text-neutral-200 placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/50';

export const CONNECTOR_PRIMARY_BUTTON_CLASSES =
  'px-4 py-2 rounded-lg bg-neutral-100/10 hover:bg-neutral-100/15 disabled:opacity-40 disabled:hover:bg-neutral-100/10 border border-neutral-700 text-neutral-300 text-sm font-medium transition-colors inline-flex items-center gap-2';

export const CONNECTOR_SECONDARY_BUTTON_CLASSES =
  'px-4 py-2 rounded-lg text-white/50 hover:text-white/80 text-sm transition-colors';

/**
 * The host of a site address, for a label ("Sign in on example.com").
 *
 * @param {string} siteUrl
 * @returns {string} The host, or the address as typed when unparsable.
 */
export function hostOfSiteUrl(siteUrl) {
  const value = String(siteUrl ?? '').trim();
  if (!value) return '';
  try {
    return new URL(value).host;
  } catch {
    return value.replace(/^https?:\/\//, '').split('/')[0];
  }
}
