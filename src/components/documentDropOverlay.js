// Helpers for the full-screen "Drop to Upload" overlay on Avatar Settings.
//
// The overlay is raised from a document-level dragenter. A cancelled OS file
// drag (Escape, or dragging back to the desktop) often never delivers a
// dragleave the page can trust — `relatedTarget` is missing or still points
// inside the document — so the overlay used to stay up and eat every click.
// Leave-the-window is decided from pointer coordinates; Escape / click /
// dragend are handled by the screen itself.

/**
 * Whether a drag payload is files or URLs Settings can ingest.
 *
 * @param {DataTransfer | {types?: ArrayLike<string> & {includes?: Function}} | null | undefined} dataTransfer
 * @returns {boolean}
 */
export function isFileOrUrlDrag(dataTransfer) {
  const types = dataTransfer?.types;
  if (!types || typeof types.includes !== 'function') {
    return false;
  }
  return types.includes('Files') || types.includes('text/uri-list');
}

/**
 * True when a dragleave happened because the pointer left the viewport.
 * Crossing from one child to another stays inside these bounds, so that
 * must not dismiss the overlay.
 *
 * @param {number} clientX
 * @param {number} clientY
 * @param {{width: number, height: number}} viewport
 * @returns {boolean}
 */
export function didDragLeaveViewport(clientX, clientY, viewport) {
  const width = viewport?.width ?? 0;
  const height = viewport?.height ?? 0;
  return (
    clientX <= 0 ||
    clientY <= 0 ||
    clientX >= width ||
    clientY >= height
  );
}

/**
 * Keys that dismiss the overlay without uploading.
 *
 * @param {string} key
 * @returns {boolean}
 */
export function isDropOverlayCancelKey(key) {
  return key === 'Escape';
}
