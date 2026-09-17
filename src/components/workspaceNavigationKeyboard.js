/**
 * Letter and `?` shortcuts for signed-in (and help-overlay) navigation.
 *
 * These keys move around Neural Nexus when the person is not typing in a
 * field and no dialog owns the keyboard. Evan's help overlay is told the
 * same list so the assistant can name them when asked how to get around.
 */

import { overlayOwnsWorkspaceEscape } from './workspaceEscapeKeyboard.js';

/** Open the world map. */
export const WORKSPACE_HOTKEY_INTENT_MAP = 'map';

/** Open the personal avatar's inbox. */
export const WORKSPACE_HOTKEY_INTENT_INBOX = 'inbox';

/** Open personal avatar settings. */
export const WORKSPACE_HOTKEY_INTENT_SETTINGS = 'settings';

/** Open the avatar gallery. */
export const WORKSPACE_HOTKEY_INTENT_AVATARS = 'avatars';

/** Open Evan's help assistant. */
export const WORKSPACE_HOTKEY_INTENT_ASSIST = 'assist';

/** Open billing. */
export const WORKSPACE_HOTKEY_INTENT_BILLING = 'billing';

/**
 * The note Evan receives every turn so the help avatar can tell the person
 * these shortcuts. Kept next to the intent table so the spoken list cannot
 * drift from what the keys actually do.
 */
export const EVAN_ASSIST_KEYBOARD_SHORTCUTS_NOTE =
  '[Neural Nexus] Keyboard shortcuts (only when the person is not typing in a ' +
  'field): m opens the world map, i opens the avatar inbox, s opens personal ' +
  'avatar settings, a opens the avatar gallery, ? opens this help assistant, ' +
  'b opens billing. Tell the person these shortcuts when the person asks how ' +
  'to move around Neural Nexus or what keys do.';

const LETTER_TO_INTENT = Object.freeze({
  m: WORKSPACE_HOTKEY_INTENT_MAP,
  i: WORKSPACE_HOTKEY_INTENT_INBOX,
  s: WORKSPACE_HOTKEY_INTENT_SETTINGS,
  a: WORKSPACE_HOTKEY_INTENT_AVATARS,
  b: WORKSPACE_HOTKEY_INTENT_BILLING,
});

/**
 * Whether a focused field should keep this letter or `?` instead of
 * navigating.
 *
 * Text fields, selects, suggestion lists, and content-editable surfaces keep
 * the key so typing and list typeahead still work.
 *
 * @param {EventTarget|null|undefined} [target]
 * @returns {boolean}
 */
export function fieldOwnsLetterHotkeys(target) {
  if (!target || typeof target !== 'object') return false;
  if (target.isContentEditable) return true;
  const tagName = String(target.tagName || '').toUpperCase();
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
    return true;
  }
  if (typeof target.closest !== 'function') return false;
  return Boolean(
    target.closest('[role="listbox"]') ||
      target.closest('[role="combobox"]') ||
      target.closest('[role="option"]') ||
      target.closest('[role="textbox"]')
  );
}

/**
 * Whether a dialog, menu, or Evan's overlay should keep letter hotkeys.
 *
 * @param {{querySelector?: Function}|null|undefined} [root]
 * @returns {boolean}
 */
export function overlayOwnsLetterHotkeys(
  root = typeof document === 'undefined' ? null : document
) {
  return overlayOwnsWorkspaceEscape(root);
}

/**
 * What a bare letter or `?` should do on this screen.
 *
 * Modifier chords are left to the browser. A focused field or open overlay
 * keeps the key. Navigation intents (`m` / `i` / `s` / `a` / `b`) need a
 * signed-in session; `?` (assist) is offered wherever Evan's help control is.
 *
 * @param {KeyboardEvent|{key?: string, altKey?: boolean, ctrlKey?: boolean, metaKey?: boolean, shiftKey?: boolean}|null|undefined} keyEvent
 * @param {Object} [context]
 * @param {boolean} [context.overlayOwnsKeys]
 * @param {boolean} [context.fieldOwnsKeys]
 * @param {boolean} [context.signedIn] Letter navigation requires a session.
 * @param {boolean} [context.assistOffered] Whether `?` may open the help overlay.
 * @returns {string|null}
 */
export function workspaceNavigationHotkeyIntent(keyEvent, context = {}) {
  if (!keyEvent) return null;
  if (keyEvent.altKey || keyEvent.ctrlKey || keyEvent.metaKey) return null;
  if (context.overlayOwnsKeys) return null;
  if (context.fieldOwnsKeys) return null;

  const key = keyEvent.key;
  if (key === '?') {
    return context.assistOffered === false
      ? null
      : WORKSPACE_HOTKEY_INTENT_ASSIST;
  }

  if (typeof key !== 'string' || key.length !== 1) return null;
  const letter = key.toLowerCase();
  const intent = LETTER_TO_INTENT[letter];
  if (!intent) return null;
  if (context.signedIn === false) return null;
  return intent;
}
