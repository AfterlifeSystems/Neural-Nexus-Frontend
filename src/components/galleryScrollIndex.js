/** Map a gallery scroll position to the item currently at center. */
export function galleryIndexFromScroll(scroll, itemWidth, length) {
  if (!itemWidth || !length) return 0;
  const itemIndex = Math.round(scroll / itemWidth);
  return ((itemIndex % length) + length) % length;
}

/**
 * Scroll position that shows `index` with the shortest travel from `scroll`.
 * Infinite wrap uses every equivalent slot: …, index − n, index, index + n, …
 */
export function nearestGalleryScroll(scroll, index, itemWidth, length) {
  if (!itemWidth || !length) return 0;
  const clamped = ((index % length) + length) % length;
  const base = itemWidth * clamped;
  const cycle = itemWidth * length;
  const k = Math.round((scroll - base) / cycle);
  return base + k * cycle;
}
