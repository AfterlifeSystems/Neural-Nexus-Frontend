import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MESSAGE_EDIT_INTENT_ACCEPT,
  MESSAGE_EDIT_INTENT_CANCEL,
  focusMessageEditTextarea,
  messageEditAcceptBlockedReason,
  messageEditAcceptButtonClassName,
  messageEditCancelButtonClassName,
  messageEditKeyIntent,
} from './messageEditKeyboard.js';

function sourceOf(fileName) {
  return readFileSync(new URL(fileName, import.meta.url), 'utf8');
}

test('Enter alone sends the edit and Escape abandons it', () => {
  assert.equal(
    messageEditKeyIntent({ key: 'Enter' }),
    MESSAGE_EDIT_INTENT_ACCEPT
  );
  assert.equal(
    messageEditKeyIntent({ key: 'Escape' }),
    MESSAGE_EDIT_INTENT_CANCEL
  );
});

test('a modified Enter types a newline instead of sending', () => {
  for (const modifier of ['shiftKey', 'altKey', 'ctrlKey', 'metaKey']) {
    assert.equal(
      messageEditKeyIntent({ key: 'Enter', [modifier]: true }),
      null,
      `${modifier}+Enter must not send the edit`
    );
  }
});

test('an Enter that commits an input-method candidate does not send', () => {
  assert.equal(messageEditKeyIntent({ key: 'Enter', isComposing: true }), null);
  assert.equal(messageEditKeyIntent({ key: 'Enter', keyCode: 229 }), null);
});

test('ordinary typing is left to the text box', () => {
  assert.equal(messageEditKeyIntent({ key: 'a' }), null);
  assert.equal(messageEditKeyIntent({ key: 'Tab' }), null);
  assert.equal(messageEditKeyIntent(null), null);
});

test('both edit buttons show a ring when tabbed to', () => {
  // An outline is not enough: index.css clears `outline` for every button
  // inside .voice-stage, .chat-composer and .avatar-settings.
  for (const className of [
    messageEditAcceptButtonClassName(),
    messageEditCancelButtonClassName(),
  ]) {
    assert.match(className, /focus-visible:ring-2/);
    assert.match(className, /focus-visible:ring-offset-2/);
  }
  assert.match(messageEditAcceptButtonClassName(), /focus-visible:ring-amber/);
});

test('button classes keep the classes the host screen adds', () => {
  assert.match(
    messageEditAcceptButtonClassName({ extraClassName: 'voice-text-btn' }),
    /voice-text-btn/
  );
  assert.match(
    messageEditCancelButtonClassName({ extraClassName: 'voice-text-btn' }),
    /voice-text-btn/
  );
});

test('the edit text box takes focus with the caret after the words', () => {
  const calls = [];
  const textarea = {
    value: 'hello there',
    focus() {
      calls.push('focus');
    },
    setSelectionRange(start, end) {
      calls.push([start, end]);
    },
  };
  focusMessageEditTextarea(textarea);
  assert.deepEqual(calls, ['focus', [11, 11]]);
  assert.doesNotThrow(() => focusMessageEditTextarea(null));
  assert.doesNotThrow(() => focusMessageEditTextarea({}));
});

test('an edit is sendable only with words and no turn in flight', () => {
  assert.equal(
    messageEditAcceptBlockedReason({ draft: 'a new version', pendingSendCount: 0 }),
    ''
  );
  assert.match(
    messageEditAcceptBlockedReason({ draft: '   ', pendingSendCount: 0 }),
    /Type the edit/
  );
  assert.match(
    messageEditAcceptBlockedReason({ draft: 'a new version', pendingSendCount: 1 }),
    /already on its way/
  );
});

test('Accept keeps its place in the Tab order while it cannot be sent', () => {
  // A `disabled` Accept is skipped by Tab, so Tab then Enter landed on Cancel
  // and threw the edit away while the previous reply was still arriving.
  const source = sourceOf('./MessageEditor.jsx');
  assert.match(source, /aria-disabled=\{!canAccept\}/);
  assert.doesNotMatch(source, /(?<!aria-)disabled=\{!canAccept\}/);
  assert.match(
    messageEditAcceptButtonClassName(),
    /aria-disabled:opacity-40/
  );
});

test('the editor focuses on mount and routes keys through the contract', () => {
  const source = sourceOf('./MessageEditor.jsx');
  assert.match(source, /focusMessageEditTextarea\(textareaRef\.current\)/);
  assert.match(source, /onKeyDown=\{handleKeyDown\}/);
  assert.match(source, /messageEditKeyIntent\(keyboardEvent\)/);
  assert.match(source, /messageEditAcceptButtonClassName/);
});

test('chat and voice mode both mount the shared editor', () => {
  for (const fileName of ['../MessageList.jsx', '../LiveVoiceMode.jsx']) {
    const source = sourceOf(fileName);
    assert.match(source, /<MessageEditor/, `${fileName} must mount the editor`);
    assert.doesNotMatch(
      source,
      /bg-amber-400\/15 text-amber-300 text-xs border border-amber-400\/30 disabled:opacity-40/,
      `${fileName} must not hand-roll the Accept button`
    );
  }
});
