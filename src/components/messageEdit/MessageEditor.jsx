// src/components/messageEdit/MessageEditor.jsx
//
// Editing a message already sent, in the chat transcript and in live voice
// mode. Both screens showed the same two buttons with the same wording, so both
// now mount this one editor and a person learns the control once.

import React, { useEffect, useRef } from 'react';

import {
  MESSAGE_EDIT_INTENT_ACCEPT,
  MESSAGE_EDIT_INTENT_CANCEL,
  MESSAGE_EDIT_KEY_HINT,
  focusMessageEditTextarea,
  messageEditAcceptBlockedReason,
  messageEditAcceptButtonClassName,
  messageEditCancelButtonClassName,
  messageEditKeyIntent,
} from './messageEditKeyboard';

export const MESSAGE_EDIT_TEXTAREA_CLASSES =
  'w-full px-2 py-1.5 bg-black/50 border border-white/10 rounded-md text-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50';

/**
 * The text box and the Accept / Cancel pair for one message being edited.
 *
 * @param {Object} props
 * @param {string} props.value The draft as edited so far.
 * @param {Function} props.onChange Called with the new draft text.
 * @param {Function} props.onAccept Called when the edit should be sent.
 * @param {Function} props.onCancel Called when the edit should be abandoned.
 * @param {number} [props.pendingSendCount] Turns already on their way, which
 *   hold this edit back until the reply being generated has arrived.
 * @param {string} [props.buttonExtraClassName] Classes the host screen adds to
 *   both buttons, such as the voice stage's `voice-text-btn` sizing.
 * @param {boolean} [props.stopPointerPropagation] Whether pointer presses on
 *   the controls must not reach the surface behind them. The voice stage drags
 *   and dismisses on pointer events, so presses there stop at the editor.
 */
export const MessageEditor = ({
  value,
  onChange,
  onAccept,
  onCancel,
  pendingSendCount = 0,
  buttonExtraClassName = '',
  stopPointerPropagation = false,
}) => {
  const textareaRef = useRef(null);
  const blockedReason = messageEditAcceptBlockedReason({
    draft: value,
    pendingSendCount,
  });
  const canAccept = !blockedReason;

  // Only on the first render of an edit: re-focusing on every keystroke would
  // fight the caret the person is moving.
  useEffect(() => {
    focusMessageEditTextarea(textareaRef.current);
  }, []);

  const handleKeyDown = (keyboardEvent) => {
    const intent = messageEditKeyIntent(keyboardEvent);
    if (intent === MESSAGE_EDIT_INTENT_ACCEPT) {
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      if (canAccept) {
        onAccept();
      }
      return;
    }
    if (intent === MESSAGE_EDIT_INTENT_CANCEL) {
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      onCancel();
    }
  };

  const handlePointerDown = stopPointerPropagation
    ? (pointerEvent) => pointerEvent.stopPropagation()
    : undefined;

  return (
    <div className="space-y-2">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(changeEvent) => onChange(changeEvent.target.value)}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        rows={3}
        aria-label="Edit your message"
        aria-keyshortcuts="Enter Escape"
        title={MESSAGE_EDIT_KEY_HINT}
        className={MESSAGE_EDIT_TEXTAREA_CLASSES}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-disabled={!canAccept}
          title={blockedReason || undefined}
          onPointerDown={handlePointerDown}
          onClick={(clickEvent) => {
            clickEvent.preventDefault();
            clickEvent.stopPropagation();
            if (!canAccept) return;
            onAccept();
          }}
          className={messageEditAcceptButtonClassName({
            extraClassName: buttonExtraClassName,
          })}
        >
          Accept
        </button>
        <button
          type="button"
          onPointerDown={handlePointerDown}
          onClick={(clickEvent) => {
            clickEvent.preventDefault();
            clickEvent.stopPropagation();
            onCancel();
          }}
          className={messageEditCancelButtonClassName({
            extraClassName: buttonExtraClassName,
          })}
        >
          Cancel
        </button>
        <span
          className={
            blockedReason
              ? 'text-[11px] text-amber-300/70'
              : 'text-[11px] text-white/40'
          }
        >
          {blockedReason || MESSAGE_EDIT_KEY_HINT}
        </span>
      </div>
    </div>
  );
};

export default MessageEditor;
