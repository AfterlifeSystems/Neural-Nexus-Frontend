// src/components/geo/avatarPinMarker.js
//
// Leaflet's default marker icon is loaded from image files next to the library,
// which a bundler rewrites and Leaflet then cannot find, leaving every marker
// invisible. These markers are drawn from inline SVG instead, in the amber the
// rest of the application already uses for a point of interest.

import L from 'leaflet';

const AMBER = '#fbbf24';
const NEUTRAL = '#d4d4d4';

function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pinSvg(fill, initials = '') {
  const letters = escapeXml(initials).slice(0, 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="34" viewBox="0 0 26 34">
    <path d="M13 0C5.8 0 0 5.8 0 13c0 9.4 11.6 20.1 12.1 20.6a1.3 1.3 0 0 0 1.8 0C14.4 33.1 26 22.4 26 13 26 5.8 20.2 0 13 0z" fill="${fill}" fill-opacity="0.92"/>
    <circle cx="13" cy="13" r="7" fill="rgba(0,0,0,0.75)"/>
    <text x="13" y="16.5" text-anchor="middle" font-size="8" font-family="system-ui,sans-serif" fill="#f5f5f5">${letters}</text>
  </svg>`;
}

function svgIcon(fill, className, initials = '') {
  return L.divIcon({
    className,
    html: pinSvg(fill, initials),
    iconSize: [26, 34],
    iconAnchor: [13, 34],
    popupAnchor: [0, -30],
  });
}

/** The marker for an avatar standing at a real-world place. */
export const avatarPinIcon = svgIcon(AMBER, 'neural-nexus-pin');

/**
 * A pin that names the avatar so two places on the same block stay distinct.
 *
 * @param {Object} options
 * @param {string} [options.initials]
 * @param {boolean} [options.owned]
 * @returns {L.DivIcon}
 */
export function labeledPinIcon({ initials = '', owned = false } = {}) {
  return svgIcon(
    owned ? AMBER : NEUTRAL,
    `neural-nexus-pin${owned ? '' : ' neural-nexus-pin-other'}`,
    initials
  );
}

/** The marker for the pin the creator is currently placing or moving. */
export const draftPinIcon = svgIcon(NEUTRAL, 'neural-nexus-pin neural-nexus-pin-draft');

/** The marker for where the person holding the device is standing. */
export const devicePositionIcon = L.divIcon({
  className: 'neural-nexus-device-position',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
    <circle cx="8" cy="8" r="7" fill="rgba(255,255,255,0.25)"/>
    <circle cx="8" cy="8" r="4" fill="#ffffff"/>
  </svg>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});
