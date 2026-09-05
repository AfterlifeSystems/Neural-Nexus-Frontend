import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  EVAN_MARGIN,
  EVAN_PILL_HEIGHT,
  EVAN_PILL_WIDTH,
  EVAN_WINDOW_HEIGHT,
  EVAN_WINDOW_WIDTH,
  assistPanelSize,
  clampAssistPosition,
  collapseFromWindow,
  defaultAssistPosition,
  expandFromPill,
  positionAfterPointerDelta,
} from './evanAssistGeometry.js';

const viewport = { width: 1280, height: 800 };
const railWidth = 56;

test('the pill shrinks on a phone so it stays beside the rail', () => {
  const size = assistPanelSize('pill', { width: 360, height: 640 }, { railWidth: 56 });
  assert.equal(size.width, 360 - 56 - EVAN_MARGIN * 2);
  assert.equal(size.height, EVAN_PILL_HEIGHT);
});

test('the default seat is the bottom-right corner, clear of the rail', () => {
  const position = defaultAssistPosition(
    viewport,
    { width: EVAN_PILL_WIDTH, height: EVAN_PILL_HEIGHT },
    { railWidth }
  );
  assert.equal(position.x, 1280 - EVAN_PILL_WIDTH - EVAN_MARGIN);
  assert.equal(position.y, 800 - EVAN_PILL_HEIGHT - EVAN_MARGIN);
});

test('a drag cannot cover the sidebar rail or leave the viewport', () => {
  const clamped = clampAssistPosition(
    { x: -40, y: 900 },
    { width: EVAN_WINDOW_WIDTH, height: EVAN_WINDOW_HEIGHT },
    viewport,
    { railWidth }
  );
  assert.equal(clamped.x, railWidth + EVAN_MARGIN);
  assert.equal(clamped.y, 800 - EVAN_WINDOW_HEIGHT - EVAN_MARGIN);
});

test('expanding the pill keeps the same bottom-right corner', () => {
  const pill = defaultAssistPosition(
    viewport,
    { width: EVAN_PILL_WIDTH, height: EVAN_PILL_HEIGHT },
    { railWidth }
  );
  const windowPosition = expandFromPill(
    pill,
    { width: EVAN_PILL_WIDTH, height: EVAN_PILL_HEIGHT },
    { width: EVAN_WINDOW_WIDTH, height: EVAN_WINDOW_HEIGHT },
    viewport,
    { railWidth }
  );
  assert.equal(windowPosition.x + EVAN_WINDOW_WIDTH, pill.x + EVAN_PILL_WIDTH);
  assert.equal(windowPosition.y + EVAN_WINDOW_HEIGHT, pill.y + EVAN_PILL_HEIGHT);
});

test('collapsing the window returns to the pill seat it grew from', () => {
  const pill = defaultAssistPosition(
    viewport,
    { width: EVAN_PILL_WIDTH, height: EVAN_PILL_HEIGHT },
    { railWidth }
  );
  const windowPosition = expandFromPill(
    pill,
    { width: EVAN_PILL_WIDTH, height: EVAN_PILL_HEIGHT },
    { width: EVAN_WINDOW_WIDTH, height: EVAN_WINDOW_HEIGHT },
    viewport,
    { railWidth }
  );
  const collapsed = collapseFromWindow(
    windowPosition,
    { width: EVAN_WINDOW_WIDTH, height: EVAN_WINDOW_HEIGHT },
    { width: EVAN_PILL_WIDTH, height: EVAN_PILL_HEIGHT },
    viewport,
    { railWidth }
  );
  assert.deepEqual(collapsed, pill);
});

test('a pointer delta moves the panel by the same amount', () => {
  assert.deepEqual(
    positionAfterPointerDelta({ x: 10, y: 20 }, { x: 5, y: 5 }, { x: 15, y: 8 }),
    { x: 20, y: 23 }
  );
});
