// How the Evan pill and expanded window sit on the screen.

export const EVAN_PILL_WIDTH = 320;
export const EVAN_PILL_HEIGHT = 56;
export const EVAN_WINDOW_WIDTH = 380;
export const EVAN_WINDOW_HEIGHT = 520;
export const EVAN_MARGIN = 16;
export const EVAN_DEFAULT_RAIL_WIDTH = 56;
export const EVAN_MIN_PILL_WIDTH = 220;

/**
 * Keep a floating panel inside the viewport and clear of the sidebar rail.
 *
 * @param {{x: number, y: number}} position
 * @param {{width: number, height: number}} size
 * @param {{width: number, height: number}} viewport
 * @param {{railWidth?: number}} [options]
 * @returns {{x: number, y: number}}
 */
export function clampAssistPosition(
  position,
  size,
  viewport,
  { railWidth = EVAN_DEFAULT_RAIL_WIDTH } = {}
) {
  const minX = railWidth + EVAN_MARGIN;
  const minY = EVAN_MARGIN;
  const maxX = Math.max(minX, (viewport?.width ?? 0) - (size?.width ?? 0) - EVAN_MARGIN);
  const maxY = Math.max(minY, (viewport?.height ?? 0) - (size?.height ?? 0) - EVAN_MARGIN);
  return {
    x: Math.min(maxX, Math.max(minX, position?.x ?? minX)),
    y: Math.min(maxY, Math.max(minY, position?.y ?? minY)),
  };
}

/**
 * Size the pill or window so it still fits beside the rail on a phone.
 *
 * @param {'pill'|'window'} kind
 * @param {{width: number, height: number}} viewport
 * @param {{railWidth?: number}} [options]
 * @returns {{width: number, height: number}}
 */
export function assistPanelSize(
  kind,
  viewport,
  { railWidth = EVAN_DEFAULT_RAIL_WIDTH } = {}
) {
  const maxWidth = Math.max(
    EVAN_MIN_PILL_WIDTH,
    (viewport?.width ?? 0) - railWidth - EVAN_MARGIN * 2
  );
  const maxHeight = Math.max(200, (viewport?.height ?? 0) - EVAN_MARGIN * 2);
  if (kind === 'window') {
    return {
      width: Math.min(EVAN_WINDOW_WIDTH, maxWidth),
      height: Math.min(EVAN_WINDOW_HEIGHT, maxHeight),
    };
  }
  return {
    width: Math.min(EVAN_PILL_WIDTH, maxWidth),
    height: EVAN_PILL_HEIGHT,
  };
}

/**
 * Default bottom-right placement, clear of the rail.
 *
 * @param {{width: number, height: number}} viewport
 * @param {{width: number, height: number}} size
 * @param {{railWidth?: number}} [options]
 * @returns {{x: number, y: number}}
 */
export function defaultAssistPosition(
  viewport,
  size,
  options = {}
) {
  return clampAssistPosition(
    {
      x: (viewport?.width ?? 0) - (size?.width ?? 0) - EVAN_MARGIN,
      y: (viewport?.height ?? 0) - (size?.height ?? 0) - EVAN_MARGIN,
    },
    size,
    viewport,
    options
  );
}

/**
 * Grow a pill into a window while keeping the same bottom-right corner.
 *
 * @param {{x: number, y: number}} pillPosition
 * @param {{width: number, height: number}} pillSize
 * @param {{width: number, height: number}} windowSize
 * @param {{width: number, height: number}} viewport
 * @param {{railWidth?: number}} [options]
 * @returns {{x: number, y: number}}
 */
export function expandFromPill(
  pillPosition,
  pillSize,
  windowSize,
  viewport,
  options = {}
) {
  const right = (pillPosition?.x ?? 0) + (pillSize?.width ?? 0);
  const bottom = (pillPosition?.y ?? 0) + (pillSize?.height ?? 0);
  return clampAssistPosition(
    {
      x: right - (windowSize?.width ?? 0),
      y: bottom - (windowSize?.height ?? 0),
    },
    windowSize,
    viewport,
    options
  );
}

/**
 * Shrink a window back to a pill while keeping the same bottom-right corner.
 *
 * @param {{x: number, y: number}} windowPosition
 * @param {{width: number, height: number}} windowSize
 * @param {{width: number, height: number}} pillSize
 * @param {{width: number, height: number}} viewport
 * @param {{railWidth?: number}} [options]
 * @returns {{x: number, y: number}}
 */
export function collapseFromWindow(
  windowPosition,
  windowSize,
  pillSize,
  viewport,
  options = {}
) {
  const right = (windowPosition?.x ?? 0) + (windowSize?.width ?? 0);
  const bottom = (windowPosition?.y ?? 0) + (windowSize?.height ?? 0);
  return clampAssistPosition(
    {
      x: right - (pillSize?.width ?? 0),
      y: bottom - (pillSize?.height ?? 0),
    },
    pillSize,
    viewport,
    options
  );
}

/**
 * Move a panel by the pointer delta from where the drag started.
 *
 * @param {{x: number, y: number}} origin
 * @param {{x: number, y: number}} startPointer
 * @param {{x: number, y: number}} currentPointer
 * @returns {{x: number, y: number}}
 */
export function positionAfterPointerDelta(origin, startPointer, currentPointer) {
  return {
    x: (origin?.x ?? 0) + ((currentPointer?.x ?? 0) - (startPointer?.x ?? 0)),
    y: (origin?.y ?? 0) + ((currentPointer?.y ?? 0) - (startPointer?.y ?? 0)),
  };
}
