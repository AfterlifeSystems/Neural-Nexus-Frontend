// src/config/avatarColorScheme.js
//
// The colours an overheard voice can be dealt when there is more than one to
// tell apart (see speakerIdentity.js). Not application chrome — that stays on
// the amber / black / white palette — and never a setting: nobody picks one.
// Distinct enough to tell two faces apart on the dark bubbles.

export const AVATAR_COLOR_SCHEME = [
  { fill: '#E57373', ring: '#EF9A9A', label: 'Coral' },
  { fill: '#FFB74D', ring: '#FFE082', label: 'Amber' },
  { fill: '#AED581', ring: '#C5E1A5', label: 'Lime' },
  { fill: '#4FC3F7', ring: '#81D4FA', label: 'Sky' },
  { fill: '#BA68C8', ring: '#CE93D8', label: 'Orchid' },
  { fill: '#4DB6AC', ring: '#80CBC4', label: 'Teal' },
  { fill: '#F06292', ring: '#F48FB1', label: 'Rose' },
  { fill: '#9575CD', ring: '#B39DDB', label: 'Violet' },
  { fill: '#A1887F', ring: '#BCAAA4', label: 'Taupe' },
  { fill: '#90A4AE', ring: '#B0BEC5', label: 'Slate' },
];

/**
 * @param {string} [hex]
 * @returns {string|null} `"r, g, b"` or null.
 */
export function rgbChannelsOf(hex) {
  const value = String(hex ?? '')
    .trim()
    .replace(/^#/, '');
  if (value.length !== 6) return null;
  const n = Number.parseInt(value, 16);
  if (Number.isNaN(n)) return null;
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}
