import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import {
  EVAN_ASSIST_KEYBOARD_SHORTCUTS_NOTE,
  WORKSPACE_HOTKEY_INTENT_ASSIST,
  WORKSPACE_HOTKEY_INTENT_AVATARS,
  WORKSPACE_HOTKEY_INTENT_BILLING,
  WORKSPACE_HOTKEY_INTENT_INBOX,
  WORKSPACE_HOTKEY_INTENT_MAP,
  WORKSPACE_HOTKEY_INTENT_SETTINGS,
  fieldOwnsLetterHotkeys,
  overlayOwnsLetterHotkeys,
  workspaceNavigationHotkeyIntent,
} from './workspaceNavigationKeyboard.js';

const componentsDirectory = dirname(fileURLToPath(import.meta.url));

const signedInContext = {
  signedIn: true,
  assistOffered: true,
  overlayOwnsKeys: false,
  fieldOwnsKeys: false,
};

test('each letter and ? maps to the matching screen', () => {
  assert.equal(
    workspaceNavigationHotkeyIntent({ key: 'm' }, signedInContext),
    WORKSPACE_HOTKEY_INTENT_MAP
  );
  assert.equal(
    workspaceNavigationHotkeyIntent({ key: 'i' }, signedInContext),
    WORKSPACE_HOTKEY_INTENT_INBOX
  );
  assert.equal(
    workspaceNavigationHotkeyIntent({ key: 's' }, signedInContext),
    WORKSPACE_HOTKEY_INTENT_SETTINGS
  );
  assert.equal(
    workspaceNavigationHotkeyIntent({ key: 'a' }, signedInContext),
    WORKSPACE_HOTKEY_INTENT_AVATARS
  );
  assert.equal(
    workspaceNavigationHotkeyIntent({ key: '?' }, signedInContext),
    WORKSPACE_HOTKEY_INTENT_ASSIST
  );
  assert.equal(
    workspaceNavigationHotkeyIntent({ key: 'b' }, signedInContext),
    WORKSPACE_HOTKEY_INTENT_BILLING
  );
  assert.equal(
    workspaceNavigationHotkeyIntent({ key: 'M' }, signedInContext),
    WORKSPACE_HOTKEY_INTENT_MAP
  );
});

test('letter navigation needs a signed-in session; ? still opens help', () => {
  const signedOut = { ...signedInContext, signedIn: false };
  assert.equal(workspaceNavigationHotkeyIntent({ key: 'm' }, signedOut), null);
  assert.equal(workspaceNavigationHotkeyIntent({ key: 'a' }, signedOut), null);
  assert.equal(
    workspaceNavigationHotkeyIntent({ key: '?' }, signedOut),
    WORKSPACE_HOTKEY_INTENT_ASSIST
  );
});

test('help is withheld when the assist control is not offered', () => {
  assert.equal(
    workspaceNavigationHotkeyIntent(
      { key: '?' },
      { ...signedInContext, assistOffered: false }
    ),
    null
  );
});

test('a focused field or open overlay keeps the key', () => {
  assert.equal(
    workspaceNavigationHotkeyIntent(
      { key: 'm' },
      { ...signedInContext, fieldOwnsKeys: true }
    ),
    null
  );
  assert.equal(
    workspaceNavigationHotkeyIntent(
      { key: '?' },
      { ...signedInContext, overlayOwnsKeys: true }
    ),
    null
  );
  assert.equal(
    workspaceNavigationHotkeyIntent(
      { key: 'a', ctrlKey: true },
      signedInContext
    ),
    null
  );
  assert.equal(
    workspaceNavigationHotkeyIntent(
      { key: 'm', metaKey: true },
      signedInContext
    ),
    null
  );
});

test('text fields and suggestion lists own letter hotkeys', () => {
  assert.equal(fieldOwnsLetterHotkeys({ tagName: 'INPUT' }), true);
  assert.equal(fieldOwnsLetterHotkeys({ tagName: 'TEXTAREA' }), true);
  assert.equal(fieldOwnsLetterHotkeys({ tagName: 'SELECT' }), true);
  assert.equal(fieldOwnsLetterHotkeys({ isContentEditable: true }), true);
  assert.equal(
    fieldOwnsLetterHotkeys({
      tagName: 'DIV',
      closest: (selector) => (selector === '[role="listbox"]' ? {} : null),
    }),
    true
  );
  assert.equal(
    fieldOwnsLetterHotkeys({ tagName: 'BUTTON', closest: () => null }),
    false
  );
});

test('an open dialog keeps letter hotkeys the same way Escape is kept', () => {
  assert.equal(
    overlayOwnsLetterHotkeys({
      querySelector: (selector) =>
        String(selector).includes('[aria-modal="true"]') ? {} : null,
    }),
    true
  );
  assert.equal(
    overlayOwnsLetterHotkeys({ querySelector: () => null }),
    false
  );
});

test('Evan is told every listed shortcut so the spoken list cannot drift', () => {
  assert.match(EVAN_ASSIST_KEYBOARD_SHORTCUTS_NOTE, /\bm opens the world map\b/);
  assert.match(EVAN_ASSIST_KEYBOARD_SHORTCUTS_NOTE, /\bi opens the avatar inbox\b/);
  assert.match(
    EVAN_ASSIST_KEYBOARD_SHORTCUTS_NOTE,
    /\bs opens personal avatar settings\b/
  );
  assert.match(
    EVAN_ASSIST_KEYBOARD_SHORTCUTS_NOTE,
    /\ba opens the avatar gallery\b/
  );
  assert.match(
    EVAN_ASSIST_KEYBOARD_SHORTCUTS_NOTE,
    /\? opens this help assistant\b/
  );
  assert.match(EVAN_ASSIST_KEYBOARD_SHORTCUTS_NOTE, /\bb opens billing\b/);
});

test('the hook is mounted from main so signed-in screens and help share one listener', () => {
  const mainSource = readFileSync(
    join(componentsDirectory, '../main.jsx'),
    'utf8'
  );
  const hookSource = readFileSync(
    join(componentsDirectory, '../hooks/useWorkspaceNavigationHotkeys.js'),
    'utf8'
  );
  assert.match(mainSource, /WorkspaceNavigationHotkeys/);
  assert.match(hookSource, /workspaceNavigationHotkeyIntent/);
  assert.match(hookSource, /usePersonalAvatarWorkspaceNavigation/);
  assert.match(hookSource, /WORKSPACE_HOTKEY_INTENT_ASSIST/);
});
