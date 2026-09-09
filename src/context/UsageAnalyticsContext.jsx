// src/context/UsageAnalyticsContext.jsx
//
// Opt-in usage analytics. The provider holds the account's consent (read from
// the API once a user is signed in) and exposes the switch the settings
// screens flip. The recorder, mounted once inside the router, does the work
// while consent is on: it records every action the person takes (clicks,
// typing into fields, submits, route changes, API requests, uploads, errors)
// and captures the page itself on an interval and after each route change,
// sending both to the API, which describes each capture and keeps everything
// per user. Nothing is recorded before consent is read, for an account that
// has not opted in, or for an anonymous visitor.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useMedia, NEW_CONVERSATION_ID } from './MediaContext';
import { observeApiRequests, endpointOfPath } from '../services/apiRequestObservers';
import {
  deleteUsageAnalyticsData,
  getUsageAnalyticsConsent,
  sendUsageAnalyticsEvents,
  sendUsageAnalyticsScreenshot,
  setUsageAnalyticsConsent,
} from '../services/usageAnalyticsApi';
import {
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
} from '../services/usageAnalytics';
import { canCapturePage, capturePage } from '../services/pageCapture';
import {
  MINIMUM_USAGE_ANALYTICS_CAPTURE_INTERVAL_SECONDS,
  USAGE_ANALYTICS_CAPTURE_INTERVAL_MS,
} from '../config/usageAnalyticsCapture';

const UsageAnalyticsContext = createContext(null);

/** Events kept in memory for the "recent actions" list beside a capture. */
const RECENT_EVENTS_KEPT = 60;

function newSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function UsageAnalyticsProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  // null until the API has answered for this account.
  const [consent, setConsent] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [sessionId] = useState(newSessionId);

  const loadConsent = useCallback(async () => {
    if (!userId) {
      setConsent(null);
      return null;
    }
    try {
      const record = await getUsageAnalyticsConsent();
      setConsent(record);
      return record;
    } catch (loadError) {
      // No repository (503), an unverified account (401), a deployment with
      // the feature off: all mean "not recording" for this session.
      console.debug('Usage analytics consent could not be read:', loadError);
      setConsent({ enabled: false, feature_enabled: false, unavailable: true });
      return null;
    }
  }, [userId]);

  useEffect(() => {
    loadConsent();
  }, [loadConsent]);

  /**
   * Opt in or out. Resolves with the stored record; throws on failure so the
   * switch can show the error and stay where the API left the record.
   */
  const updateConsent = useCallback(
    async (enabled, source) => {
      setIsSaving(true);
      try {
        const record = await setUsageAnalyticsConsent(enabled, source);
        setConsent(record);
        return record;
      } finally {
        setIsSaving(false);
      }
    },
    []
  );

  const deleteRecordedData = useCallback(async () => deleteUsageAnalyticsData(), []);

  const value = useMemo(
    () => ({
      consent,
      isLoaded: consent !== null,
      isEnabled: Boolean(consent?.enabled) && consent?.feature_enabled !== false,
      isFeatureAvailable: consent ? consent.feature_enabled !== false && !consent.unavailable : true,
      isSaving,
      sessionId,
      updateConsent,
      reloadConsent: loadConsent,
      deleteRecordedData,
    }),
    [consent, isSaving, sessionId, updateConsent, loadConsent, deleteRecordedData]
  );

  return (
    <UsageAnalyticsContext.Provider value={value}>
      {children}
    </UsageAnalyticsContext.Provider>
  );
}

export const useUsageAnalytics = () => {
  const context = useContext(UsageAnalyticsContext);
  if (!context) {
    throw new Error('useUsageAnalytics must be used within UsageAnalyticsProvider');
  }
  return context;
};

/**
 * The recorder. Renders nothing; mounted once inside the router so the route
 * is known. Everything below runs only while `isEnabled` is true.
 */
export function UsageAnalyticsRecorder() {
  const { isEnabled, sessionId, reloadConsent } = useUsageAnalytics();
  const { user, activeAvatar } = useAuth();
  const { activeConversation } = useMedia();
  const location = useLocation();

  const route = routeLabel(location.pathname, location.search);
  const assistantId = activeAvatar?.assistant_id ?? activeAvatar?.avatar_id ?? null;
  const threadId =
    activeConversation && activeConversation !== NEW_CONVERSATION_ID
      ? activeConversation
      : null;

  // The mutable state of the recorder lives in refs: listeners and timers
  // must read the latest values without being re-registered on every render.
  const queueRef = useRef([]);
  const oldestQueuedAtRef = useRef(null);
  const recentRef = useRef([]);
  const eventsSinceCaptureRef = useRef(0);
  const stoppedRef = useRef(false);
  const contextRef = useRef({ route, assistantId, threadId });
  contextRef.current = { route, assistantId, threadId };

  const captureRef = useRef({
    inFlight: false,
    lastCaptureAt: null,
    lastCaptureRoute: null,
    retryAfterUntil: null,
  });
  // The interval loop owns the upload; the route-change effect below borrows
  // the same function through this ref so the two never race on the state.
  const captureNowRef = useRef(null);

  const stopRecording = useCallback(
    (reason) => {
      if (stoppedRef.current) return;
      stoppedRef.current = true;
      queueRef.current = [];
      console.debug('Usage analytics stopped:', reason);
      // The API's answer is the record: re-read consent so the switch shows
      // what the server holds.
      reloadConsent();
    },
    [reloadConsent]
  );

  const flush = useCallback(
    async ({ keepalive = false } = {}) => {
      if (stoppedRef.current || queueRef.current.length === 0) return;
      const events = queueRef.current;
      queueRef.current = [];
      oldestQueuedAtRef.current = null;
      const { route: currentRoute, assistantId: currentAvatar, threadId: currentThread } =
        contextRef.current;
      try {
        await sendUsageAnalyticsEvents(
          {
            session_id: sessionId,
            assistant_id: currentAvatar,
            thread_id: currentThread,
            route: currentRoute,
            events,
          },
          { keepalive }
        );
      } catch (sendError) {
        if (isRecordingRefusal(sendError)) {
          stopRecording(sendError.message);
          return;
        }
        // Put the batch back so a blip does not lose the actions; a second
        // failure on the same batch drops the batch rather than growing forever.
        if (events.length < 400 && !events.retried) {
          events.retried = true;
          queueRef.current = events.concat(queueRef.current);
          oldestQueuedAtRef.current = Date.now();
        }
      }
    },
    [sessionId, stopRecording]
  );

  const record = useCallback(
    (kind, name, extra = {}) => {
      if (stoppedRef.current) return;
      const { route: currentRoute, assistantId: currentAvatar, threadId: currentThread } =
        contextRef.current;
      const event = makeUsageEvent({
        kind,
        name,
        route: currentRoute,
        assistant_id: currentAvatar,
        thread_id: currentThread,
        ...extra,
      });
      queueRef.current.push(event);
      if (oldestQueuedAtRef.current == null) oldestQueuedAtRef.current = Date.now();
      recentRef.current = recentRef.current.concat(event).slice(-RECENT_EVENTS_KEPT);
      eventsSinceCaptureRef.current += 1;
      if (
        shouldFlushEvents({
          queued: queueRef.current.length,
          oldestQueuedAt: oldestQueuedAtRef.current,
          now: Date.now(),
        })
      ) {
        flush();
      }
    },
    [flush]
  );

  // ── the action log ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isEnabled || !user) return undefined;
    stoppedRef.current = false;
    record('session', 'start', {
      detail: {
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        language: navigator.language,
      },
    });

    const onClick = (clickEvent) => {
      const control = actionableAncestor(clickEvent.target);
      record('click', describeEventTarget(control), {
        target: describeEventTarget(clickEvent.target),
      });
    };
    // A field is recorded once per focus, when the person leaves the field:
    // what was edited, never what was typed.
    const onChange = (changeEvent) => {
      const field = changeEvent.target;
      const tag = String(field?.tagName ?? '').toLowerCase();
      if (!['input', 'textarea', 'select'].includes(tag)) return;
      const type = String(field.getAttribute?.('type') ?? tag).toLowerCase();
      const detail = { field_type: type };
      if (type === 'checkbox' || type === 'radio') detail.checked = Boolean(field.checked);
      if (type === 'file') detail.files = field.files?.length ?? 0;
      if (type === 'file') {
        record('upload', describeEventTarget(field), { detail });
        return;
      }
      if (!['password'].includes(type)) detail.length = String(field.value ?? '').length;
      record('input', describeEventTarget(field), { detail });
    };
    const onSubmit = (submitEvent) => {
      record('submit', describeEventTarget(submitEvent.target));
    };
    const onKeyDown = (keyEvent) => {
      // Only keys that do something on their own: submits and shortcuts.
      const isShortcut = keyEvent.metaKey || keyEvent.ctrlKey;
      if (keyEvent.key !== 'Enter' && keyEvent.key !== 'Escape' && !isShortcut) return;
      const combo = [
        keyEvent.ctrlKey && 'Ctrl',
        keyEvent.metaKey && 'Meta',
        keyEvent.shiftKey && 'Shift',
        keyEvent.key,
      ]
        .filter(Boolean)
        .join('+');
      record('keyboard', combo, { target: describeEventTarget(keyEvent.target) });
    };
    const onVisibility = () => {
      record('visibility', document.visibilityState);
      if (document.visibilityState === 'hidden') flush({ keepalive: true });
    };
    const onError = (errorEvent) => {
      record('error', String(errorEvent.message ?? 'error').slice(0, 160), {
        detail: { source: errorEvent.filename ?? null, line: errorEvent.lineno ?? null },
      });
    };
    const onRejection = (rejectionEvent) => {
      const reason = rejectionEvent.reason;
      record('error', String(reason?.message ?? reason ?? 'rejection').slice(0, 160), {
        detail: { status: reason?.status ?? null },
      });
    };
    const onDrop = (dropEvent) => {
      const files = dropEvent.dataTransfer?.files?.length ?? 0;
      if (files > 0) record('upload', 'drop', { detail: { files } });
    };
    const onBeforeUnload = () => {
      record('session', 'end');
      flush({ keepalive: true });
    };

    document.addEventListener('click', onClick, true);
    document.addEventListener('change', onChange, true);
    document.addEventListener('submit', onSubmit, true);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('drop', onDrop, true);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    window.addEventListener('beforeunload', onBeforeUnload);
    const stopObservingRequests = observeApiRequests((outcome) => {
      record('api_request', `${outcome.method} ${endpointOfPath(outcome.path)}`, {
        detail: {
          status: outcome.status,
          ok: outcome.ok,
          duration_ms: outcome.durationMs,
          aborted: outcome.aborted,
        },
      });
    });
    const flushTimer = window.setInterval(() => {
      if (
        shouldFlushEvents({
          queued: queueRef.current.length,
          oldestQueuedAt: oldestQueuedAtRef.current,
          now: Date.now(),
        })
      ) {
        flush();
      }
    }, EVENT_FLUSH_INTERVAL_MS);

    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('change', onChange, true);
      document.removeEventListener('submit', onSubmit, true);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('drop', onDrop, true);
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      window.removeEventListener('beforeunload', onBeforeUnload);
      stopObservingRequests();
      window.clearInterval(flushTimer);
      flush({ keepalive: true });
    };
  }, [isEnabled, user, record, flush]);

  // Every route change is an action.
  useEffect(() => {
    if (!isEnabled || !user) return;
    record('navigation', route);
  }, [isEnabled, user, route, record]);

  // ── page captures ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isEnabled || !user || !canCapturePage()) return undefined;
    let cancelled = false;
    let timer = null;

    const captureNow = async (trigger) => {
      const state = captureRef.current;
      const { route: currentRoute, assistantId: currentAvatar, threadId: currentThread } =
        contextRef.current;
      state.inFlight = true;
      state.lastCaptureAt = Date.now();
      state.lastCaptureRoute = currentRoute;
      const recent = summariseRecentActions(recentRef.current);
      eventsSinceCaptureRef.current = 0;
      try {
        const image = await capturePage();
        if (cancelled || stoppedRef.current) return;
        await sendUsageAnalyticsScreenshot(image, {
          session_id: sessionId,
          assistant_id: currentAvatar,
          thread_id: currentThread,
          route: currentRoute,
          trigger,
          recent_actions: recent,
          occurred_at: new Date(state.lastCaptureAt).toISOString(),
        });
      } catch (captureError) {
        if (isRecordingRefusal(captureError)) {
          stopRecording(captureError.message);
        } else if (captureError?.status === 429) {
          state.retryAfterUntil =
            Date.now() +
            retryAfterMilliseconds(captureError, USAGE_ANALYTICS_CAPTURE_INTERVAL_MS);
        } else {
          console.debug('Usage analytics capture failed:', captureError);
        }
      } finally {
        state.inFlight = false;
      }
    };

    const tick = (trigger = 'interval') => {
      if (cancelled || stoppedRef.current) return;
      const state = captureRef.current;
      const now = Date.now();
      if (
        shouldCapturePage({
          enabled: true,
          visible: document.visibilityState === 'visible',
          inFlight: state.inFlight,
          lastCaptureAt: state.lastCaptureAt,
          lastCaptureRoute: state.lastCaptureRoute,
          route: contextRef.current.route,
          eventsSinceCapture: eventsSinceCaptureRef.current,
          intervalMs: USAGE_ANALYTICS_CAPTURE_INTERVAL_MS,
          minimumGapMs: MINIMUM_USAGE_ANALYTICS_CAPTURE_INTERVAL_SECONDS * 1000,
          retryAfterUntil: state.retryAfterUntil,
          now,
        })
      ) {
        captureNow(trigger);
      }
      timer = window.setTimeout(
        () => tick('interval'),
        nextCaptureDelayMs({
          lastCaptureAt: state.lastCaptureAt,
          intervalMs: USAGE_ANALYTICS_CAPTURE_INTERVAL_MS,
          retryAfterUntil: state.retryAfterUntil,
          now: Date.now(),
        })
      );
    };

    captureNowRef.current = captureNow;
    // The first look waits for the screen to paint.
    timer = window.setTimeout(() => tick('session_start'), 2500);
    return () => {
      cancelled = true;
      captureNowRef.current = null;
      if (timer) window.clearTimeout(timer);
    };
  }, [isEnabled, user, sessionId, stopRecording]);

  // A route change earns a capture once the new screen has painted.
  useEffect(() => {
    if (!isEnabled || !user || !canCapturePage()) return undefined;
    const state = captureRef.current;
    if (state.lastCaptureAt == null) return undefined;
    const timer = window.setTimeout(() => {
      if (stoppedRef.current) return;
      if (
        shouldCapturePage({
          enabled: true,
          visible: document.visibilityState === 'visible',
          inFlight: state.inFlight,
          lastCaptureAt: state.lastCaptureAt,
          lastCaptureRoute: state.lastCaptureRoute,
          route,
          eventsSinceCapture: eventsSinceCaptureRef.current,
          intervalMs: USAGE_ANALYTICS_CAPTURE_INTERVAL_MS,
          minimumGapMs: MINIMUM_USAGE_ANALYTICS_CAPTURE_INTERVAL_SECONDS * 1000,
          retryAfterUntil: state.retryAfterUntil,
          now: Date.now(),
        })
      ) {
        captureNowRef.current?.('navigation');
      }
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [isEnabled, user, route]);

  return null;
}
