// src/components/messageEdit/messageEditKeyboard.js
//
// The keyboard contract for editing a message already sent, and the styling of
// the two buttons that close that edit.
//
// A person who edits a sent message is already typing, so the edit has to be
// finishable from the keyboard: Enter sends the edit, Shift+Enter adds a
// newline, Escape abandons the edit. Tab moves from the text box to Accept, and
// Accept has to SHOW that Tab landed there. A Tailwind ring is used rather than
// an outline because `index.css` clears `outline` for every button inside
// `.voice-stage`, `.chat-composer` and `.avatar-settings`, which is where these
// editors are mounted — an outline-based focus style is invisible in all three.
//
// Accept is never given the `disabled` attribute, because a disabled button is
// skipped by Tab: while the avatar's previous reply was still arriving, Tab
// from the text box jumped straight past Accept onto Cancel, and the Enter that
// was meant to send the edit threw the edit away instead. Accept stays
// focusable, says `aria-disabled` while the edit cannot be sent, and names the
// reason next to the buttons.

/** Sends the edit. */
export const MESSAGE_EDIT_INTENT_ACCEPT = 'accept';

/** Abandons the edit and restores the message as sent. */
export const MESSAGE_EDIT_INTENT_CANCEL = 'cancel';

/** Shown under the buttons so the keyboard route is discoverable. */
export const MESSAGE_EDIT_KEY_HINT =
  'Enter sends · Shift+Enter newline · Esc cancels';

/**
 * What a key pressed inside the edit text box means.
 *
 * Enter carries a modifier when the person wants a newline rather than a send,
 * which matches the main composer in `InputBar`. A keystroke being composed by
 * an input method editor is never a send: the Enter that commits a Japanese or
 * Chinese candidate would otherwise send a half-typed edit.
 *
 * @param {KeyboardEvent} keyboardEvent The keydown event from the text box.
 * @returns {string|null} `accept`, `cancel`, or null to let the text box type.
 */
export function messageEditKeyIntent(keyboardEvent) {
  if (!keyboardEvent) {
    return null;
  }
  if (keyboardEvent.isComposing || keyboardEvent.keyCode === 229) {
    return null;
  }
  if (keyboardEvent.key === 'Escape') {
    return MESSAGE_EDIT_INTENT_CANCEL;
  }
  if (keyboardEvent.key !== 'Enter') {
    return null;
  }
  const wantsNewline =
    keyboardEvent.shiftKey ||
    keyboardEvent.altKey ||
    keyboardEvent.ctrlKey ||
    keyboardEvent.metaKey;
  return wantsNewline ? null : MESSAGE_EDIT_INTENT_ACCEPT;
}

const FOCUS_RING_CLASSES =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black';

/**
 * Why this edit cannot be sent yet, in the words shown to the person.
 *
 * An empty string means the edit is ready to send. Both screens that mount the
 * editor share this rule, so Accept behaves the same in the transcript and on
 * the voice stage.
 *
 * @param {Object} options
 * @param {string} options.draft The edit as typed so far.
 * @param {number} [options.pendingSendCount] Turns already on their way.
 * @returns {string} The reason, or an empty string when the edit can be sent.
 */
export function messageEditAcceptBlockedReason({ draft, pendingSendCount = 0 }) {
  if (!String(draft ?? '').trim()) {
    return 'Type the edit before sending it.';
  }
  if (pendingSendCount > 0) {
    return 'A reply is already on its way — this edit can be sent once that turn finishes.';
  }
  return '';
}

/**
 * Classes for the button that sends the edit.
 *
 * `aria-disabled` rather than `disabled` styles the blocked state, because the
 * button keeps its place in the Tab order while the edit cannot be sent.
 *
 * @param {Object} [options]
 * @param {string} [options.extraClassName] Classes the host screen adds.
 * @returns {string}
 */
export function messageEditAcceptButtonClassName({ extraClassName = '' } = {}) {
  return [
    'px-2 py-1 rounded-md text-xs border transition-colors',
    'bg-amber-400/15 text-amber-300 border-amber-400/30',
    'hover:bg-amber-400/25 hover:text-amber-200',
    FOCUS_RING_CLASSES,
    'focus-visible:ring-amber-300 focus-visible:bg-amber-400/30 focus-visible:text-amber-100 focus-visible:border-amber-300',
    'aria-disabled:opacity-40 aria-disabled:cursor-not-allowed aria-disabled:hover:bg-amber-400/15 aria-disabled:hover:text-amber-300',
    extraClassName,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Classes for the button that abandons the edit.
 *
 * @param {Object} [options]
 * @param {string} [options.extraClassName] Classes the host screen adds.
 * @returns {string}
 */
export function messageEditCancelButtonClassName({ extraClassName = '' } = {}) {
  return [
    'px-2 py-1 rounded-md text-xs border transition-colors',
    'bg-white/5 text-white/70 border-white/10',
    'hover:bg-white/10 hover:text-neutral-100',
    FOCUS_RING_CLASSES,
    'focus-visible:ring-white/70 focus-visible:bg-white/10 focus-visible:text-neutral-100',
    extraClassName,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Put the caret in the edit text box, at the end of the words already there.
 *
 * The Edit control unmounts the moment editing starts, so without this the
 * browser drops focus to the document body and the next Tab lands at the top of
 * the page instead of on Accept.
 *
 * @param {HTMLTextAreaElement|null} textarea The mounted text box.
 * @returns {void}
 */
export function focusMessageEditTextarea(textarea) {
  if (!textarea || typeof textarea.focus !== 'function') {
    return;
  }
  textarea.focus();
  const caret = String(textarea.value ?? '').length;
  if (typeof textarea.setSelectionRange === 'function') {
    textarea.setSelectionRange(caret, caret);
  }
}
