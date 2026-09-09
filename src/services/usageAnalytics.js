// src/services/usageAnalytics.js
//
// Opt-in usage analytics: the pure decisions behind the recorder, kept free of
// React and the browser so they can be tested (the API calls live in
// usageAnalyticsApi.js): what one click becomes as an event, how a queue of
// events is batched, and when a page capture is due.

/** How many events a batch holds before the queue flushes early. */
export const EVENT_FLUSH_COUNT = 40;
/** How long, in milliseconds, events wait before the queue flushes. */
export const EVENT_FLUSH_INTERVAL_MS = 5000;
/** How many recent actions are sent beside a capture for the describer. */
export const RECENT_ACTIONS_FOR_CAPTURE = 25;
/** The kinds the API accepts; see src/anubis/utils/usage_analytics/events.py. */
export const EVENT_KINDS = Object.freeze([
  'click',
  'input',
  'submit',
  'keyboard',
  'navigation',
  'api_request',
  'upload',
  'error',
  'visibility',
  'session',
  'custom',
]);

// ── pure helpers ──────────────────────────────────────────────────────────

/**
 * A readable name for the element a person acted on.
 *
 * Prefers what the person could see: the accessible label, the visible text,
 * a placeholder, then a tag and id. Text is clipped so a long paragraph the
 * person clicked never becomes the record. Password fields report no value
 * anywhere; this names the control, never the content.
 *
 * @param {Object|null} element A DOM element (or a plain object in tests).
 * @returns {string}
 */
export function describeEventTarget(element) {
  if (!element) return 'unknown';
  const tag = String(element.tagName ?? '').toLowerCase() || 'element';
  const attribute = (name) =>
    typeof element.getAttribute === 'function'
      ? element.getAttribute(name)
      : element[name];
  const label =
    attribute('aria-label') ||
    attribute('title') ||
    attribute('placeholder') ||
    attribute('name') ||
    '';
  const text = String(element.innerText ?? element.textContent ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  const identity = attribute('id') ? `#${attribute('id')}` : '';
  const role = attribute('role') ? `[${attribute('role')}]` : '';
  const type =
    tag === 'input' && attribute('type') ? `[${attribute('type')}]` : '';
  const visible = (label || text).slice(0, 60);
  return `${tag}${type}${role}${identity}${visible ? `:${visible}` : ''}`;
}

/**
 * Walk up from a click's target to the control the click was meant for.
 *
 * A click on the icon inside a button is a click on the button.
 *
 * @param {Object|null} element
 * @returns {Object|null}
 */
export function actionableAncestor(element) {
  let current = element;
  let depth = 0;
  while (current && depth < 8) {
    const tag = String(current.tagName ?? '').toLowerCase();
    const role =
      typeof current.getAttribute === 'function'
        ? current.getAttribute('role')
        : current.role;
    if (
      ['button', 'a', 'input', 'select', 'textarea', 'summary', 'label'].includes(
        tag
      ) ||
      ['button', 'switch', 'tab', 'menuitem', 'link', 'option', 'checkbox'].includes(
        role ?? ''
      )
    ) {
      return current;
    }
    current = current.parentElement ?? null;
    depth += 1;
  }
  return element;
}

/**
 * Turn a path and search into the route label stored with every event.
 *
 * Identifiers are replaced so routes group by screen: `/chat/asst_123` is
 * recorded as `/chat/{id}`. The `tab` query parameter is kept because the
 * chat screen switches between chat, settings, and inbox through the query.
 *
 * @param {string} pathname
 * @param {string} [search]
 * @returns {string}
 */
export function routeLabel(pathname, search = '') {
  const path = String(pathname ?? '/')
    .split('/')
    .map((segment) =>
      /^[0-9a-f-]{16,}$/i.test(segment) ||
      /^(asst|thread|run|auth0\|)/i.test(segment) ||
      (segment.length > 24 && !/^[a-z_-]+$/i.test(segment))
        ? '{id}'
        : segment
    )
    .join('/');
  const parameters = new URLSearchParams(String(search ?? ''));
  const tab = parameters.get('tab');
  const section = parameters.get('section');
  const suffix = [tab && `tab=${tab}`, section && `section=${section}`]
    .filter(Boolean)
    .join('&');
  return suffix ? `${path}?${suffix}` : path;
}

/**
 * Build one event object in the shape the API stores.
 *
 * @param {Object} fields
 * @param {string} fields.kind One of EVENT_KINDS.
 * @param {string} fields.name What happened, for example `button:Send`.
 * @param {string} [fields.route]
 * @param {string} [fields.target]
 * @param {Object} [fields.detail]
 * @param {number} [fields.now] Milliseconds since the epoch (tests).
 * @returns {Object}
 */
export function makeUsageEvent({
  kind,
  name,
  route,
  target,
  detail,
  assistant_id,
  thread_id,
  now,
}) {
  return {
    kind: EVENT_KINDS.includes(kind) ? kind : 'custom',
    name: String(name ?? '').slice(0, 160),
    route: route ?? null,
    target: target ? String(target).slice(0, 400) : null,
    detail: detail && typeof detail === 'object' ? detail : {},
    assistant_id: assistant_id ?? null,
    thread_id: thread_id ?? null,
    occurred_at: new Date(now ?? Date.now()).toISOString(),
  };
}

/**
 * The batching decisions of the event queue, without timers.
 *
 * @param {Object} state
 * @param {number} state.queued How many events are waiting.
 * @param {number|null} state.oldestQueuedAt When the oldest waiting event was
 *   queued (milliseconds), or null when nothing waits.
 * @param {number} state.now
 * @returns {boolean} Whether to flush now.
 */
export function shouldFlushEvents({ queued, oldestQueuedAt, now }) {
  if (queued <= 0) return false;
  if (queued >= EVENT_FLUSH_COUNT) return true;
  return oldestQueuedAt != null && now - oldestQueuedAt >= EVENT_FLUSH_INTERVAL_MS;
}

/**
 * Whether a page capture is due on this tick.
 *
 * A capture is skipped while the tab is hidden (nothing to see), while one
 * is still uploading, while the server asked the client to wait, and when
 * nothing happened since the last capture on the same route: an idle page
 * captured again adds a vision call and no information. A route change
 * always earns one capture once the interval floor has passed.
 *
 * @param {Object} conditions
 * @param {boolean} conditions.enabled Consent is on and the account is signed in.
 * @param {boolean} conditions.visible The tab is visible.
 * @param {boolean} conditions.inFlight A capture is uploading.
 * @param {number|null} conditions.lastCaptureAt When the last capture started.
 * @param {string|null} conditions.lastCaptureRoute The route of the last capture.
 * @param {string} conditions.route The current route.
 * @param {number} conditions.eventsSinceCapture Actions since the last capture.
 * @param {number} conditions.intervalMs The configured interval.
 * @param {number} conditions.minimumGapMs The floor between two captures.
 * @param {number|null} conditions.retryAfterUntil A server-imposed wait.
 * @param {number} conditions.now
 * @returns {boolean}
 */
export function shouldCapturePage({
  enabled,
  visible,
  inFlight,
  lastCaptureAt,
  lastCaptureRoute,
  route,
  eventsSinceCapture,
  intervalMs,
  minimumGapMs,
  retryAfterUntil,
  now,
}) {
  if (!enabled || !visible || inFlight) return false;
  if (retryAfterUntil != null && now < retryAfterUntil) return false;
  if (lastCaptureAt == null) return true;
  const elapsed = now - lastCaptureAt;
  if (elapsed < minimumGapMs) return false;
  const routeChanged = lastCaptureRoute !== route;
  if (routeChanged) return true;
  if (elapsed < intervalMs) return false;
  return eventsSinceCapture > 0;
}

/**
 * The next wait, in milliseconds, before the capture loop should look again.
 *
 * @param {Object} conditions
 * @param {number|null} conditions.lastCaptureAt
 * @param {number} conditions.intervalMs
 * @param {number|null} conditions.retryAfterUntil
 * @param {number} conditions.now
 * @returns {number}
 */
export function nextCaptureDelayMs({ lastCaptureAt, intervalMs, retryAfterUntil, now }) {
  let delay = lastCaptureAt == null ? intervalMs : intervalMs - (now - lastCaptureAt);
  if (retryAfterUntil != null) delay = Math.max(delay, retryAfterUntil - now);
  return Math.max(1000, Math.min(intervalMs, delay));
}

/**
 * Render the last few events as the list sent beside a capture.
 *
 * @param {Object[]} events Events in the order they happened.
 * @param {number} [limit]
 * @returns {string}
 */
export function summariseRecentActions(events, limit = RECENT_ACTIONS_FOR_CAPTURE) {
  return events
    .slice(-limit)
    .map((event) => {
      const stamp = String(event.occurred_at ?? '').slice(11, 19);
      const parts = [event.kind, event.name];
      if (event.target) parts.push(`on ${event.target}`);
      if (event.route) parts.push(`at ${event.route}`);
      return `- ${stamp} ${parts.filter(Boolean).join(' ')}`.trimEnd();
    })
    .join('\n');
}

/**
 * How long the server asked the client to wait after a 429, in milliseconds.
 *
 * @param {Object|null} error An ApiError with `headers`.
 * @param {number} fallbackMs
 * @returns {number}
 */
export function retryAfterMilliseconds(error, fallbackMs) {
  const header = error?.headers?.get?.('Retry-After');
  const seconds = Number.parseFloat(header ?? '');
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : fallbackMs;
}

/**
 * Whether an error from a recording call means "stop recording".
 *
 * 403 (not opted in, or anonymous) and 404 (the deployment turned the
 * feature off) are answers, not outages: the recorder stops until consent
 * is read again.
 *
 * @param {Object|null} error
 * @returns {boolean}
 */
export function isRecordingRefusal(error) {
  return error?.status === 403 || error?.status === 404;
}
