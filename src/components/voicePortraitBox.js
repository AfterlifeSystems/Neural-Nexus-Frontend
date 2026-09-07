/**
 * Where the voice-stage portrait actually paints, and the speak glow that
 * frames that video — the same aspect ratio as the still or clip, not a circle.
 */

/**
 * Intrinsic pixel size of a video, still, or idle-loop canvas.
 *
 * @param {HTMLVideoElement|HTMLImageElement|HTMLCanvasElement|null|undefined} element
 * @returns {{width: number, height: number}|null}
 */
export function mediaIntrinsicSize(element) {
  if (!element) return null;
  const tag = element.tagName;
  if (tag === 'VIDEO') {
    const width = element.videoWidth;
    const height = element.videoHeight;
    if (width > 0 && height > 0) return { width, height };
    return null;
  }
  if (tag === 'IMG') {
    const width = element.naturalWidth;
    const height = element.naturalHeight;
    if (width > 0 && height > 0) return { width, height };
    return null;
  }
  if (tag === 'CANVAS') {
    const width = element.width;
    const height = element.height;
    if (width > 0 && height > 0) return { width, height };
  }
  return null;
}

/**
 * The box `object-fit: contain` uses inside a well.
 *
 * @param {number} wellWidth
 * @param {number} wellHeight
 * @param {number} [mediaWidth]
 * @param {number} [mediaHeight]
 * @returns {{x: number, y: number, width: number, height: number}}
 */
export function objectContainBox(
  wellWidth,
  wellHeight,
  mediaWidth,
  mediaHeight
) {
  if (!(wellWidth > 0) || !(wellHeight > 0)) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  if (!(mediaWidth > 0) || !(mediaHeight > 0)) {
    return { x: 0, y: 0, width: wellWidth, height: wellHeight };
  }
  const wellRatio = wellWidth / wellHeight;
  const mediaRatio = mediaWidth / mediaHeight;
  if (mediaRatio > wellRatio) {
    const width = wellWidth;
    const height = wellWidth / mediaRatio;
    return { x: 0, y: (wellHeight - height) / 2, width, height };
  }
  const height = wellHeight;
  const width = wellHeight * mediaRatio;
  return { x: (wellWidth - width) / 2, y: 0, width, height };
}

/**
 * The media layer currently shown in the portrait (crossfades keep the
 * outgoing face in the DOM at opacity 0).
 *
 * @param {Element|null|undefined} root
 * @returns {Element|null}
 */
export function paintedMediaIn(root) {
  const nodes = [...(root?.querySelectorAll?.('video, canvas, img') ?? [])];
  if (nodes.length === 0) return null;
  const shown = nodes.filter((node) => !node.classList?.contains('opacity-0'));
  return shown.at(-1) ?? nodes.at(-1) ?? null;
}

/**
 * Largest box of the media's aspect ratio that fits in `constraint`.
 * Before the still or clip reports a size, a square so the stage still has a
 * portrait.
 *
 * @param {Element|null|undefined} constraint
 * @param {Element|null|undefined} media
 * @returns {{width: number, height: number}|null}
 */
export function portraitWellSizeForConstraint(constraint, media) {
  if (!constraint) return null;
  const width = constraint.clientWidth;
  const height = constraint.clientHeight;
  if (!(width > 0) || !(height > 0)) return null;
  const intrinsic = mediaIntrinsicSize(media);
  if (!(intrinsic?.width > 0) || !(intrinsic?.height > 0)) {
    const size = Math.min(width, height);
    return { width: size, height: size };
  }
  const box = objectContainBox(width, height, intrinsic.width, intrinsic.height);
  return { width: box.width, height: box.height };
}
