/**
 * Escape and gallery arrows on signed-in (and shared-link) screens.
 *
 * An open overlay keeps Escape: a dialog, a menu, the User Settings menu,
 * Evan's help window, or the computer takeover. An open sidebar closes next.
 * On chat, inbox, or avatar settings, Escape then goes to Avatar Selection.
 *
 * ArrowDown on chat and ArrowUp on avatar settings are the reverse of the
 * gallery: they open Avatar Selection. A field, list, or image viewport that
 * already uses the arrows keeps them.
 */

/** Collapse the application sidebar. */
export const WORKSPACE_ESCAPE_INTENT_CLOSE_SIDEBAR = 'close-sidebar';

/** Open Avatar Selection. */
export const WORKSPACE_ESCAPE_INTENT_AVATAR_SELECTION = 'avatar-selection';

/**
 * Overlays that already own Escape. One query so the document listener does
 * not steal the key from a dialog that registered later on the same bubble.
 *
 * Conversation starter chips use role="menu" in document flow. They are not
 * a dialog, and they do not handle Escape or arrows, so they must not block
 * leaving chat for Avatar Selection. An unused avatar (empty new thread)
 * raises that list; avatars with a first send already keep it folded.
 */
export const WORKSPACE_ESCAPE_OVERLAY_SELECTOR = [
  '[aria-modal="true"]:not([hidden])',
  '[role="menu"]:not([hidden]):not([data-conversation-suggestion-sheet])',
  '[data-evan-assist-overlay]',
  '[data-agent-computer-takeover]',
  '[data-user-settings-menu] [aria-expanded="true"]',
].join(', ');

/**
 * Whether a dialog, menu, or other overlay should keep this Escape.
 *
 * @param {{querySelector?: Function}|null|undefined} [root]
 * @returns {boolean}
 */
export function overlayOwnsWorkspaceEscape(
  root = typeof document === 'undefined' ? null : document
) {
  if (!root || typeof root.querySelector !== 'function') return false;
  return Boolean(root.querySelector(WORKSPACE_ESCAPE_OVERLAY_SELECTOR));
}

/**
 * Whether the focused control should keep ArrowUp or ArrowDown instead of
 * leaving for Avatar Selection.
 *
 * Text fields, selects, suggestion lists, and the framed portrait keep the
 * key so the caret, the list highlight, and panning still work.
 *
 * @param {EventTarget|null|undefined} [target]
 * @returns {boolean}
 */
export function fieldOwnsArrowKeys(target) {
  if (!target || typeof target !== 'object') return false;
  if (target.isContentEditable) return true;
  const tagName = String(target.tagName || '').toUpperCase();
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
    return true;
  }
  if (typeof target.closest !== 'function') return false;
  return Boolean(
    target.closest('[data-image-viewport]') ||
      target.closest('[role="listbox"]') ||
      target.closest('[role="combobox"]') ||
      target.closest('[role="option"]')
  );
}

/**
 * What Escape should do on this screen.
 *
 * @param {KeyboardEvent|{key?: string, altKey?: boolean, ctrlKey?: boolean, metaKey?: boolean}|null|undefined} keyEvent
 * @param {Object} [context]
 * @param {boolean} [context.overlayOwnsEscape]
 * @param {boolean} [context.sidebarOpen]
 * @param {boolean} [context.canGoToAvatarSelection]
 * @returns {string|null}
 */
export function workspaceEscapeIntent(keyEvent, context = {}) {
  if (!keyEvent || keyEvent.key !== 'Escape') return null;
  if (keyEvent.altKey || keyEvent.ctrlKey || keyEvent.metaKey) return null;
  if (context.overlayOwnsEscape) return null;
  if (context.sidebarOpen) return WORKSPACE_ESCAPE_INTENT_CLOSE_SIDEBAR;
  if (context.canGoToAvatarSelection) {
    return WORKSPACE_ESCAPE_INTENT_AVATAR_SELECTION;
  }
  return null;
}

/**
 * What ArrowUp and ArrowDown should do toward Avatar Selection.
 *
 * ArrowUp on settings and ArrowDown on chat reverse the gallery: gallery up
 * opens chat, gallery down opens settings.
 *
 * @param {KeyboardEvent|{key?: string, altKey?: boolean, ctrlKey?: boolean, metaKey?: boolean}|null|undefined} keyEvent
 * @param {Object} [context]
 * @param {boolean} [context.overlayOwnsEscape]
 * @param {boolean} [context.fieldOwnsArrows]
 * @param {boolean} [context.isAvatarSettings]
 * @param {boolean} [context.isAvatarChat]
 * @returns {string|null}
 */
export function workspaceGalleryArrowIntent(keyEvent, context = {}) {
  if (!keyEvent) return null;
  if (keyEvent.altKey || keyEvent.ctrlKey || keyEvent.metaKey) return null;
  if (context.overlayOwnsEscape) return null;
  if (context.fieldOwnsArrows) return null;
  if (keyEvent.key === 'ArrowUp' && context.isAvatarSettings) {
    return WORKSPACE_ESCAPE_INTENT_AVATAR_SELECTION;
  }
  if (keyEvent.key === 'ArrowDown' && context.isAvatarChat) {
    return WORKSPACE_ESCAPE_INTENT_AVATAR_SELECTION;
  }
  return null;
}
