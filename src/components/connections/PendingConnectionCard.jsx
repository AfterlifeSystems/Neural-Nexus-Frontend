// src/components/connections/PendingConnectionCard.jsx
import React from 'react';
import { useMedia } from '../../context/MediaContext';
import { CONNECT_ACCOUNT_INTERRUPT_KIND } from '../../services/connectionCards';
import ConnectionCardStack from './ConnectionCardStack';

/**
 * The connect card of the current pause, on its own.
 *
 * Voice mode with captions hidden shows no transcript, so the card the
 * paused turn is waiting on would be invisible; this puts that one card
 * above the composer dock. With captions shown the card is already in the
 * strip, on the message that paused, and this renders nothing extra.
 *
 * @param {Object} parameters
 * @param {string} [parameters.assistantId] The avatar on screen.
 * @param {boolean} [parameters.compact] Voice-mode sizing.
 * @param {string} [parameters.className] Layout classes.
 */
const PendingConnectionCard = ({
  assistantId = null,
  compact = true,
  className = 'self-start w-full max-w-[min(100%,28rem)] sm:max-w-[85%] caption-actions pointer-events-auto',
}) => {
  const { pendingInterrupt, messages } = useMedia();
  if (pendingInterrupt?.interrupt?.kind !== CONNECT_ACCOUNT_INTERRUPT_KIND) {
    return null;
  }
  if (assistantId && pendingInterrupt.assistantId !== assistantId) return null;
  const pauseMessage = (messages ?? []).find(
    (message) => String(message?.id) === String(pendingInterrupt.pauseMessageId)
  );
  if (!pauseMessage) return null;
  return (
    <ConnectionCardStack
      message={pauseMessage}
      assistantId={assistantId}
      compact={compact}
      className={className}
    />
  );
};

export default PendingConnectionCard;
