// src/services/desktopNotifications.js
//
// One place for the browser's desktop notifications. They are a convenience
// for a person who has looked away: a notification is shown only when the tab
// is hidden or unfocused, and only when permission was granted; a browser that
// refuses them changes nothing else.

/**
 * Show a desktop notification when the person is not looking at this tab.
 *
 * @param {Object} notification
 * @param {string} notification.title The notification's title.
 * @param {string} notification.body The notification's text.
 * @param {string} notification.tag Deduplication tag; a newer notification with the same tag replaces the older one.
 * @returns {boolean} Whether a notification was shown.
 */
export function notifyDesktopIfHidden({ title, body, tag }) {
  try {
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission !== 'granted') return false;
    if (
      typeof document !== 'undefined' &&
      document.visibilityState === 'visible' &&
      document.hasFocus()
    ) {
      return false;
    }
    new Notification(title, { body, tag });
    return true;
  } catch {
    return false;
  }
}

/**
 * Ask once for permission to show desktop notifications.
 *
 * @returns {Promise<string>} The resulting permission.
 */
export async function requestDesktopNotificationPermission() {
  try {
    if (typeof Notification === 'undefined') return 'unsupported';
    if (Notification.permission === 'default') {
      return Notification.requestPermission();
    }
    return Notification.permission;
  } catch {
    return 'unsupported';
  }
}

/**
 * The desktop notification for something the avatar noticed and decided the
 * person should hear about.
 *
 * @param {string} avatarName Who noticed.
 * @param {string} summary One line saying what was noticed.
 * @returns {boolean} Whether a notification was shown.
 */
export function notifyAmbientObservation(avatarName, summary) {
  return notifyDesktopIfHidden({
    title: `${avatarName || 'Your avatar'} noticed something`,
    body: summary || 'Open the conversation to see the heads-up.',
    tag: 'neural-nexus-ambient',
  });
}
