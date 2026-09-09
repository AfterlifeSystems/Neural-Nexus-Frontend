import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  EVENT_FLUSH_COUNT,
  EVENT_FLUSH_INTERVAL_MS,
  actionableAncestor,
  describeEventTarget,
  isRecordingRefusal,
  makeUsageEvent,
  nextCaptureDelayMs,
  retryAfterMilliseconds,
  routeLabel,
  shouldCapturePage,
  shouldFlushEvents,
  summariseRecentActions,
} from './usageAnalytics.js';
import { endpointOfPath } from './apiRequestObservers.js';
import { usageAnalyticsCaptureIntervalMilliseconds } from '../config/usageAnalyticsCaptureInterval.js';

const element = (tagName, attributes = {}, text = '') => ({
  tagName,
  innerText: text,
  getAttribute: (name) => attributes[name] ?? null,
  parentElement: null,
});

test('a click target is named by what the person could see, never by a value', () => {
  assert.equal(
    describeEventTarget(element('BUTTON', { 'aria-label': 'Send message' }, 'Send')),
    'button:Send message'
  );
  assert.equal(
    describeEventTarget(element('INPUT', { type: 'password', name: 'password' })),
    'input[password]:password'
  );
  assert.equal(
    describeEventTarget(element('DIV', { id: 'gallery' }, 'x'.repeat(100))),
    `div#gallery:${'x'.repeat(60)}`
  );
  assert.equal(describeEventTarget(null), 'unknown');
});

test('a click inside a button is a click on the button', () => {
  const button = element('BUTTON', {}, 'Open');
  const icon = { ...element('SVG'), parentElement: button };
  assert.equal(actionableAncestor(icon), button);
  const plain = element('P', {}, 'text');
  assert.equal(actionableAncestor(plain), plain);
  const menuItem = element('DIV', { role: 'menuitem' }, 'Rename');
  assert.equal(actionableAncestor(menuItem), menuItem);
});

test('routes and endpoints group by screen with identifiers replaced', () => {
  assert.equal(routeLabel('/chat/asst_a1b2c3', '?tab=settings&x=1'), '/chat/{id}?tab=settings');
  assert.equal(routeLabel('/avatars'), '/avatars');
  assert.equal(
    routeLabel('/share/0f9c2a1e-1111-2222-3333-444455556666/c/abc'),
    '/share/{id}/c/abc'
  );
  assert.equal(
    endpointOfPath('/conversations/0f9c2a1e-1111-2222-3333-444455556666/messages?limit=5'),
    '/conversations/{id}/messages'
  );
  assert.equal(endpointOfPath('/message/asst_123'), '/message/{id}');
});

test('an event carries a known kind, a clipped name, and an ISO timestamp', () => {
  const event = makeUsageEvent({
    kind: 'teleport',
    name: 'n'.repeat(200),
    route: '/avatars',
    target: 'button:Open',
    now: Date.UTC(2026, 8, 7, 12, 0, 0),
  });
  assert.equal(event.kind, 'custom');
  assert.equal(event.name.length, 160);
  assert.equal(event.occurred_at, '2026-09-07T12:00:00.000Z');
  assert.deepEqual(event.detail, {});
});

test('events flush on count or on age, never when empty', () => {
  assert.equal(shouldFlushEvents({ queued: 0, oldestQueuedAt: 0, now: 10_000 }), false);
  assert.equal(shouldFlushEvents({ queued: EVENT_FLUSH_COUNT, oldestQueuedAt: 9_000, now: 10_000 }), true);
  assert.equal(shouldFlushEvents({ queued: 1, oldestQueuedAt: 9_000, now: 10_000 }), false);
  assert.equal(
    shouldFlushEvents({ queued: 1, oldestQueuedAt: 10_000 - EVENT_FLUSH_INTERVAL_MS, now: 10_000 }),
    true
  );
});

test('a capture is due after the interval only when something happened, and at once on a route change', () => {
  const base = {
    enabled: true,
    visible: true,
    inFlight: false,
    lastCaptureAt: 0,
    lastCaptureRoute: '/avatars',
    route: '/avatars',
    eventsSinceCapture: 3,
    intervalMs: 30_000,
    minimumGapMs: 10_000,
    retryAfterUntil: null,
    now: 30_000,
  };
  assert.equal(shouldCapturePage(base), true);
  assert.equal(shouldCapturePage({ ...base, eventsSinceCapture: 0 }), false);
  assert.equal(shouldCapturePage({ ...base, now: 20_000 }), false);
  assert.equal(shouldCapturePage({ ...base, now: 12_000, route: '/chat/{id}' }), true);
  assert.equal(shouldCapturePage({ ...base, now: 5_000, route: '/chat/{id}' }), false);
  assert.equal(shouldCapturePage({ ...base, lastCaptureAt: null, now: 0, eventsSinceCapture: 0 }), true);
  assert.equal(shouldCapturePage({ ...base, visible: false }), false);
  assert.equal(shouldCapturePage({ ...base, enabled: false }), false);
  assert.equal(shouldCapturePage({ ...base, inFlight: true }), false);
  assert.equal(shouldCapturePage({ ...base, retryAfterUntil: 40_000 }), false);
});

test('the capture loop waits out the interval and any server-imposed pause', () => {
  assert.equal(nextCaptureDelayMs({ lastCaptureAt: null, intervalMs: 30_000, retryAfterUntil: null, now: 0 }), 30_000);
  assert.equal(nextCaptureDelayMs({ lastCaptureAt: 0, intervalMs: 30_000, retryAfterUntil: null, now: 25_000 }), 5_000);
  assert.equal(nextCaptureDelayMs({ lastCaptureAt: 0, intervalMs: 30_000, retryAfterUntil: 29_000, now: 25_000 }), 5_000);
  assert.equal(nextCaptureDelayMs({ lastCaptureAt: 0, intervalMs: 30_000, retryAfterUntil: null, now: 29_900 }), 1_000);
});

test('recent actions read as a short list the describer can follow', () => {
  const text = summariseRecentActions([
    { kind: 'navigation', name: 'route', route: '/avatars', occurred_at: '2026-09-07T12:00:05.000Z' },
    { kind: 'click', name: 'button:Open', target: 'button:Open', occurred_at: '2026-09-07T12:00:06.000Z' },
  ]);
  assert.equal(
    text,
    '- 12:00:05 navigation route at /avatars\n- 12:00:06 click button:Open on button:Open'
  );
});

test('a refusal stops recording; a Retry-After paces it', () => {
  assert.equal(isRecordingRefusal({ status: 403 }), true);
  assert.equal(isRecordingRefusal({ status: 404 }), true);
  assert.equal(isRecordingRefusal({ status: 500 }), false);
  assert.equal(
    retryAfterMilliseconds({ headers: new Map([['Retry-After', '12']]) }, 5_000),
    12_000
  );
  assert.equal(retryAfterMilliseconds({ headers: null }, 5_000), 5_000);
});

test('the capture interval setting has a default and a floor', () => {
  assert.equal(usageAnalyticsCaptureIntervalMilliseconds(undefined), 30_000);
  assert.equal(usageAnalyticsCaptureIntervalMilliseconds('2'), 10_000);
  assert.equal(usageAnalyticsCaptureIntervalMilliseconds('45'), 45_000);
  assert.equal(usageAnalyticsCaptureIntervalMilliseconds('abc'), 30_000);
});
