/** Fraction of the card where the pixel bloom and glow start. */
export const PIXEL_CARD_ORIGIN_X = 0.5;
export const PIXEL_CARD_ORIGIN_Y = 0.5;

/**
 * CSS percent for a 0–1 origin fraction.
 *
 * @param {number} fraction
 * @returns {string}
 */
export function pixelCardOriginCssPercent(fraction) {
  const number = Number(fraction);
  if (!Number.isFinite(number)) return '50%';
  return `${number * 100}%`;
}

/**
 * Read a CSS custom-property origin (`50%` or a 0–1 number).
 *
 * @param {string|null|undefined} cssValue
 * @param {number} [fallback]
 * @returns {number}
 */
export function pixelCardOriginFraction(cssValue, fallback = 0.5) {
  const trimmed = String(cssValue ?? '').trim();
  if (!trimmed) return fallback;
  if (trimmed.endsWith('%')) {
    const number = Number.parseFloat(trimmed);
    return Number.isFinite(number) ? number / 100 : fallback;
  }
  const number = Number.parseFloat(trimmed);
  return Number.isFinite(number) ? number : fallback;
}

/**
 * Appear delay so pixels bloom from the origin, not from a nearby icon.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @param {number} [originX]
 * @param {number} [originY]
 * @returns {number}
 */
export function pixelAppearDelay(
  x,
  y,
  width,
  height,
  originX = PIXEL_CARD_ORIGIN_X,
  originY = PIXEL_CARD_ORIGIN_Y
) {
  const deltaX = x - width * originX;
  const deltaY = y - height * originY;
  return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}
