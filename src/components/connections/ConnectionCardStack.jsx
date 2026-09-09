// src/components/connections/ConnectionCardStack.jsx
import React from 'react';
import ConnectAccountCard from '../ConnectAccountCard';
import { useMedia } from '../../context/MediaContext';
import {
  connectionKeyOfCard,
  connectionsOf,
  isPendingCard,
} from '../../services/connectionCards';

/**
 * The connect cards one transcript message carries, in place.
 *
 * A card is INTERACTIVE while the owner can still act on the card: the
 * message is the one the current pause sits on, or the card was put in the
 * transcript from the "+" menu and has not connected yet. Every other card
 * — a record on a stored reply, a card already settled — is read-only.
 *
 * Finishing a card on the current pause resumes the paused turn; finishing a
 * "+"-menu card sends the hidden acknowledgement turn instead, so the avatar
 * greets the new account and the transcript gets the record a reload shows.
 *
 * @param {Object} parameters
 * @param {Object} parameters.message The transcript message.
 * @param {string} [parameters.assistantId] The avatar on screen; a pause that
 *   belongs to another avatar is shown read-only here.
 * @param {boolean} [parameters.compact] Voice-mode sizing.
 * @param {boolean} [parameters.readOnly] A shared transcript: nothing here
 *   can be pressed.
 * @param {string} [parameters.className] Layout classes for the stack.
 * @param {Function} [parameters.onConnected] Called with the settled record
 *   after a "+"-menu card connects.
 */
const ConnectionCardStack = ({
  message,
  assistantId = null,
  compact = false,
  readOnly = false,
  className = 'self-start w-full max-w-[85%] min-w-0',
  onConnected = null,
}) => {
  const {
    pendingInterrupt,
    resumePendingInterrupt,
    settleConnectionCard,
    removeConnectionCard,
    sendConnectionAcknowledgement,
  } = useMedia();

  const cards = connectionsOf(message);
  if (cards.length === 0) return null;

  const isCurrentPause =
    pendingInterrupt?.pauseMessageId != null &&
    String(pendingInterrupt.pauseMessageId) === String(message.id) &&
    (!assistantId || pendingInterrupt.assistantId === assistantId);

  const handleDecision = async (decision, items, resultCard) => {
    if (isCurrentPause) {
      await resumePendingInterrupt(decision, items, resultCard);
      return;
    }
    if (decision !== 'apply') {
      removeConnectionCard(message.id);
      return;
    }
    settleConnectionCard(message.id, resultCard);
    onConnected?.(resultCard);
    const connectionKey = connectionKeyOfCard(resultCard);
    if (connectionKey) {
      await sendConnectionAcknowledgement(connectionKey, {
        cardMessageId: message.id,
      });
    }
  };

  return (
    <div className={`${className} space-y-2`}>
      {cards.map((card, index) => {
        const interactive =
          !readOnly &&
          isPendingCard(card) &&
          (isCurrentPause || Boolean(message.clientCard));
        const key = `${card?.provider ?? 'card'}-${index}`;
        return interactive ? (
          <ConnectAccountCard
            key={key}
            interrupt={card}
            startOpen={Boolean(message.clientCard)}
            compact={compact}
            className="w-full"
            onDecision={handleDecision}
          />
        ) : (
          <ConnectAccountCard
            key={key}
            card={card}
            compact={compact}
            className="w-full"
          />
        );
      })}
    </div>
  );
};

export default ConnectionCardStack;
