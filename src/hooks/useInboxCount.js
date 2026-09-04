// src/hooks/useInboxCount.js
import { useEffect, useRef, useState } from 'react';
import { getInboxCount } from '../services/avatarService';
import { useAuth } from '../context/AuthContext';
import {
  notifyDesktopIfHidden,
  requestDesktopNotificationPermission,
} from '../services/desktopNotifications';

const POLL_MILLISECONDS = 60_000;

// One poller for the whole app: several menus may mount this hook, and the
// count must not be fetched once per mount.
let sharedCount = 0;
let lastNotifiedCount = 0;
const listeners = new Set();
let pollTimer = null;
let inFlight = null;

async function refreshSharedCount() {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const response = await getInboxCount();
      const next = Number(response?.pending_count ?? 0);
      const rose = next > sharedCount && next > lastNotifiedCount;
      sharedCount = next;
      for (const listener of listeners) listener(next);
      if (rose) {
        lastNotifiedCount = next;
        notifyDesktop(next);
      }
    } catch {
      // A missing personal avatar, a signed-out session, or an API hiccup all
      // read as "no badge" — never as an error in the menu.
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

function notifyDesktop(count) {
  notifyDesktopIfHidden({
    title: 'Neural Nexus',
    body: `${count} ${count === 1 ? 'message needs' : 'messages need'} your attention in the avatar inbox.`,
    tag: 'neural-nexus-inbox',
  });
}

/**
 * Ask once for permission to show desktop notifications.
 *
 * @returns {Promise<string>} The resulting permission.
 */
export async function requestInboxNotifications() {
  return requestDesktopNotificationPermission();
}

/**
 * The number of agent-inbox items awaiting the owner, refreshed in the
 * background and on window focus, with a desktop notification when it rises.
 *
 * @returns {number} The pending count (0 while unknown).
 */
export default function useInboxCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(sharedCount);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return undefined;
    }
    mountedRef.current = true;
    listeners.add(setCount);
    refreshSharedCount();
    if (!pollTimer) {
      pollTimer = setInterval(refreshSharedCount, POLL_MILLISECONDS);
    }
    const onFocus = () => refreshSharedCount();
    window.addEventListener('focus', onFocus);
    return () => {
      mountedRef.current = false;
      listeners.delete(setCount);
      window.removeEventListener('focus', onFocus);
      if (listeners.size === 0 && pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };
  }, [user]);

  return count;
}

/** Force a refresh (after the owner resolved an item). */
export const refreshInboxCount = refreshSharedCount;
