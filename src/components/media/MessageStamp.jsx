import React from 'react';
import {
  formatMessageStamp,
  messageStampDateTime,
  messageStampValueOf,
} from '../../services/messageStamp';

/**
 * Date and time on a transcript row. Empty when the row never recorded
 * when it was written.
 *
 * @param {Object} parameters
 * @param {Object} [parameters.message] The transcript row.
 * @param {string|number|Date|null} [parameters.value] A stamp when the row is not passed.
 * @param {boolean} [parameters.overlay] Lighter type on a caption over a stage.
 * @param {string} [parameters.className] Extra classes.
 */
const MessageStamp = ({
  message,
  value,
  overlay = false,
  className = '',
}) => {
  const stampValue = value ?? messageStampValueOf(message);
  const label = formatMessageStamp(stampValue);
  const dateTime = messageStampDateTime(stampValue);
  if (!label || !dateTime) return null;

  return (
    <time
      dateTime={dateTime}
      className={`text-xs text-right select-none ${
        overlay ? 'text-white/60' : 'text-neutral-400'
      } ${className}`.trim()}
    >
      {label}
    </time>
  );
};

export default MessageStamp;
