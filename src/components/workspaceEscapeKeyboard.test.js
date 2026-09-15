import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  WORKSPACE_ESCAPE_INTENT_AVATAR_SELECTION,
  WORKSPACE_ESCAPE_INTENT_CLOSE_SIDEBAR,
  WORKSPACE_ESCAPE_OVERLAY_SELECTOR,
  fieldOwnsArrowKeys,
  overlayOwnsWorkspaceEscape,
  workspaceEscapeIntent,
  workspaceGalleryArrowIntent,
} from './workspaceEscapeKeyboard.js';
import {
  isAvatarChatLocation,
  isAvatarSettingsLocation,
  isAvatarWorkspaceEscapeLocation,
} from './personalAvatarWorkspace.js';

const componentsDirectory = dirname(fileURLToPath(import.meta.url));

const escapeKey = { key: 'Escape' };
const workspaceOpen = { canGoToAvatarSelection: true };

test('Escape closes an open sidebar before leaving the workspace', () => {
  assert.equal(
    workspaceEscapeIntent(escapeKey, {
      ...workspaceOpen,
      sidebarOpen: true,
    }),
    WORKSPACE_ESCAPE_INTENT_CLOSE_SIDEBAR
  );
});

test('Escape on chat, inbox, or settings goes to avatar selection', () => {
  assert.equal(
    workspaceEscapeIntent(escapeKey, workspaceOpen),
    WORKSPACE_ESCAPE_INTENT_AVATAR_SELECTION
  );
  assert.equal(isAvatarWorkspaceEscapeLocation('/chat/maya-1'), true);
  assert.equal(isAvatarWorkspaceEscapeLocation('/inbox'), true);
  assert.equal(isAvatarWorkspaceEscapeLocation('/avatars'), false);
  assert.equal(isAvatarWorkspaceEscapeLocation('/account'), false);
  assert.equal(isAvatarWorkspaceEscapeLocation('/billing'), false);
  assert.equal(isAvatarWorkspaceEscapeLocation('/map'), false);
});

test('a hidden suggestion menu does not keep Escape', () => {
  assert.equal(
    overlayOwnsWorkspaceEscape({
      querySelector: (selector) => {
        if (!selector.includes(':not([hidden])')) return { hidden: true };
        return null;
      },
    }),
    false
  );
});

test('a dialog or menu keeps Escape', () => {
  assert.equal(
    workspaceEscapeIntent(escapeKey, {
      ...workspaceOpen,
      sidebarOpen: true,
      overlayOwnsEscape: true,
    }),
    null
  );
  assert.equal(
    overlayOwnsWorkspaceEscape({
      querySelector: (selector) =>
        selector.includes('[aria-modal="true"]') ? {} : null,
    }),
    true
  );
  assert.equal(
    overlayOwnsWorkspaceEscape({ querySelector: () => null }),
    false
  );
});

test('the signed-in frame and the shared-link frame both listen', () => {
  const protectedSource = readFileSync(
    join(componentsDirectory, 'ProtectedRoute.jsx'),
    'utf8'
  );
  const sharedSource = readFileSync(
    join(componentsDirectory, 'SharedAvatarLayout.jsx'),
    'utf8'
  );
  const hookSource = readFileSync(
    join(componentsDirectory, '../hooks/useWorkspaceEscape.js'),
    'utf8'
  );
  assert.match(protectedSource, /useWorkspaceEscape/);
  assert.match(protectedSource, /isAvatarWorkspaceEscapeLocation/);
  assert.match(protectedSource, /isAvatarSettingsLocation/);
  assert.match(protectedSource, /isAvatarChatLocation/);
  assert.match(protectedSource, /avatarGalleryKeepAliveClassName/);
  assert.match(protectedSource, /avatarWorkspaceKeepAliveClassName/);
  assert.match(protectedSource, /navigate\('\/avatars'\)/);
  assert.match(sharedSource, /useWorkspaceEscape/);
  assert.match(hookSource, /workspaceGalleryArrowIntent/);
});

const arrowUpKey = { key: 'ArrowUp' };
const arrowDownKey = { key: 'ArrowDown' };
const settingsArrowContext = { isAvatarSettings: true };
const chatArrowContext = { isAvatarChat: true };

test('ArrowUp on avatar settings goes to avatar selection', () => {
  assert.equal(
    workspaceGalleryArrowIntent(arrowUpKey, settingsArrowContext),
    WORKSPACE_ESCAPE_INTENT_AVATAR_SELECTION
  );
  assert.equal(isAvatarSettingsLocation('/chat/maya-1', '?tab=settings'), true);
  assert.equal(isAvatarSettingsLocation('/chat/maya-1', ''), false);
  assert.equal(
    isAvatarSettingsLocation('/chat/maya-1', '?tab=inbox'),
    false
  );
  assert.equal(isAvatarSettingsLocation('/inbox', '?tab=settings'), false);
  assert.equal(isAvatarSettingsLocation('/avatars', '?tab=settings'), false);
});

test('an open conversation suggestion sheet does not keep Escape or gallery arrows', () => {
  assert.match(
    WORKSPACE_ESCAPE_OVERLAY_SELECTOR,
    /data-conversation-suggestion-sheet/
  );
  const suggestionsSource = readFileSync(
    join(componentsDirectory, 'ConversationSuggestions.jsx'),
    'utf8'
  );
  assert.match(suggestionsSource, /data-conversation-suggestion-sheet/);
  assert.equal(
    overlayOwnsWorkspaceEscape({
      querySelector: (selector) => {
        if (selector.includes('[data-conversation-suggestion-sheet]')) {
          return null;
        }
        if (selector.includes('[role="menu"]')) {
          return { getAttribute: () => 'menu' };
        }
        return null;
      },
    }),
    false
  );
  assert.equal(
    workspaceGalleryArrowIntent(arrowDownKey, {
      ...chatArrowContext,
      overlayOwnsEscape: false,
    }),
    WORKSPACE_ESCAPE_INTENT_AVATAR_SELECTION
  );
});

test('ArrowDown on chat goes to avatar selection', () => {
  assert.equal(
    workspaceGalleryArrowIntent(arrowDownKey, chatArrowContext),
    WORKSPACE_ESCAPE_INTENT_AVATAR_SELECTION
  );
  assert.equal(isAvatarChatLocation('/chat/maya-1', ''), true);
  assert.equal(isAvatarChatLocation('/chat/maya-1', '?thread=new'), true);
  assert.equal(isAvatarChatLocation('/chat/maya-1', '?tab=settings'), false);
  assert.equal(isAvatarChatLocation('/chat/maya-1', '?tab=inbox'), false);
  assert.equal(isAvatarChatLocation('/inbox'), false);
  assert.equal(isAvatarChatLocation('/avatars'), false);
});

test('ArrowUp on chat and ArrowDown on settings stay put', () => {
  assert.equal(
    workspaceGalleryArrowIntent(arrowUpKey, chatArrowContext),
    null
  );
  assert.equal(
    workspaceGalleryArrowIntent(arrowDownKey, settingsArrowContext),
    null
  );
  assert.equal(
    workspaceGalleryArrowIntent(arrowDownKey, { isAvatarChat: false }),
    null
  );
});

test('a field, list, overlay, or modifier keeps the gallery arrows', () => {
  assert.equal(
    workspaceGalleryArrowIntent(arrowUpKey, {
      ...settingsArrowContext,
      fieldOwnsArrows: true,
    }),
    null
  );
  assert.equal(
    workspaceGalleryArrowIntent(arrowDownKey, {
      ...chatArrowContext,
      fieldOwnsArrows: true,
    }),
    null
  );
  assert.equal(
    workspaceGalleryArrowIntent(arrowUpKey, {
      ...settingsArrowContext,
      overlayOwnsEscape: true,
    }),
    null
  );
  assert.equal(
    workspaceGalleryArrowIntent(
      { key: 'ArrowUp', ctrlKey: true },
      settingsArrowContext
    ),
    null
  );
  assert.equal(
    workspaceGalleryArrowIntent(
      { key: 'ArrowDown', metaKey: true },
      chatArrowContext
    ),
    null
  );
  assert.equal(fieldOwnsArrowKeys({ tagName: 'INPUT' }), true);
  assert.equal(fieldOwnsArrowKeys({ tagName: 'TEXTAREA' }), true);
  assert.equal(fieldOwnsArrowKeys({ tagName: 'SELECT' }), true);
  assert.equal(fieldOwnsArrowKeys({ isContentEditable: true }), true);
  assert.equal(
    fieldOwnsArrowKeys({
      tagName: 'DIV',
      closest: (selector) =>
        selector === '[data-image-viewport]' ? {} : null,
    }),
    true
  );
  assert.equal(
    fieldOwnsArrowKeys({ tagName: 'BUTTON', closest: () => null }),
    false
  );
  assert.equal(fieldOwnsArrowKeys(null), false);
});
