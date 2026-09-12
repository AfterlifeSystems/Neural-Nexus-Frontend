// src/components/ConversationSuggestions.jsx
//
// Prompts for the current thread, always painted above the composer.
// An empty new conversation gets starters; after a reply, follow-ups.
// Only the first opening list is harvested from the avatar on its own
// (and cached per avatar); every later harvest costs an avatar turn and
// happens only when the person presses Re-roll.
// The list stays in flow so it cannot cover the message box. It raises
// itself only on an empty new chat and folds on the first send; after
// that the handle (tap or swipe) or Re-roll raises it. A pick, Escape,
// or a click elsewhere never hides the chips. Voice mode and message mode
// share the open/closed flag.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMedia, NEW_CONVERSATION_ID } from '../context/MediaContext';
import { isConversationSuggestionList } from '../services/conversationSuggestions';
import { subscribeStandardConversationStarters } from '../services/standardConversationStarters';
import { resolveAssistantId } from './utils';
import {
  getSuggestionSheetOpen,
  setSuggestionSheetOpen,
  shouldAutoOpenSuggestionSheet,
  shouldCollapseSuggestionSheetAfterSend,
  shouldGenerateConversationSuggestions,
  shouldLoadConversationSuggestions,
  shouldShowConversationSuggestions,
  suggestionSheetMenuClassName,
  subscribeSuggestionSheetOpen,
} from './conversationSuggestionSheet';

/**
 * @param {Object} parameters
 * @param {boolean} [parameters.enabled] When false, render nothing (shared
 *   opening-question screens already offer a starter).
 * @param {Function} [parameters.onSend] Send a prompt. Voice mode supplies this
 *   so a suggestion is spoken as a turn rather than typed into the chat
 *   composer.
 * @param {boolean} [parameters.overlay] Voice mode: distinct menu id only.
 *   The list stays in flow above the composer so it cannot cover the field.
 */
const ConversationSuggestions = ({ enabled = true, onSend, overlay = false }) => {
  const {
    messages,
    pendingSendCount,
    handleSendMessageMediaContext,
    fetchConversationSuggestions,
    activeConversation,
  } = useMedia();
  const { activeAvatar } = useAuth();
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpenState] = useState(getSuggestionSheetOpen);
  // Bumped when the open avatar's standard set of starters changes (deep
  // research finished, the owner regenerated), so an empty conversation
  // repaints with the new set without a reload.
  const [standardStartersVersion, setStandardStartersVersion] = useState(0);
  const requestGeneration = useRef(0);
  const dragStartY = useRef(null);

  useEffect(() => {
    setIsOpenState(getSuggestionSheetOpen());
    return subscribeSuggestionSheetOpen(setIsOpenState);
  }, []);

  const lastAvatarMessage = [...(messages ?? [])]
    .reverse()
    .find((message) => {
      if (
        message.type !== 'ai' ||
        !message.content ||
        message.isLoading ||
        message.stopped
      ) {
        return false;
      }
      return !isConversationSuggestionList(message.content);
    });
  const hasHumanTurn = (messages ?? []).some(
    (message) => message.type === 'human' || message.type === 'user'
  );
  const isNewConversation = activeConversation === NEW_CONVERSATION_ID;
  const shouldLoad = shouldLoadConversationSuggestions({
    hasSpokenAvatarReply: Boolean(lastAvatarMessage),
    isNewConversation,
    hasHumanTurn,
  });
  const assistantId = resolveAssistantId(activeAvatar) ?? 'none';

  useEffect(() => {
    return subscribeStandardConversationStarters((changedAssistantId) => {
      if (String(changedAssistantId) !== String(assistantId)) return;
      setStandardStartersVersion((version) => version + 1);
    });
  }, [assistantId]);

  // Raise the starters only at the start of a conversation; fold them on
  // the first send. Runs when the thread changes or the first human turn
  // lands, never on later replies, so a list the person raised by hand
  // stays up.
  useEffect(() => {
    if (!enabled) return;
    if (shouldAutoOpenSuggestionSheet({ isNewConversation, hasHumanTurn })) {
      setSuggestionSheetOpen(true);
    } else if (shouldCollapseSuggestionSheetAfterSend()) {
      setSuggestionSheetOpen(false);
    }
  }, [enabled, activeConversation, isNewConversation, hasHumanTurn]);

  // The standard-set version only matters while the chips are starters;
  // a conversation that has begun keeps its follow-ups.
  const openingVersion =
    lastAvatarMessage || hasHumanTurn ? '' : `:v${standardStartersVersion}`;
  const suggestionKey = `${assistantId}:${activeConversation ?? 'none'}:${
    lastAvatarMessage?.id ?? (shouldLoad ? 'opening' : 'empty')
  }${openingVersion}`;

  const loadSuggestions = useCallback(
    async ({ exclude = [], generate = false } = {}) => {
      const thisGeneration = ++requestGeneration.current;
      if (generate) {
        // Paint identity-leaned local chips at once. A harvest is a full
        // avatar turn and can take a minute; a re-roll must change the
        // chips immediately and let the harvest upgrade them when it lands.
        const immediate = await fetchConversationSuggestions?.({
          exclude,
          generate: false,
        });
        if (
          requestGeneration.current === thisGeneration &&
          Array.isArray(immediate)
        ) {
          setSuggestions(immediate);
        }
      }
      setIsLoading(true);
      try {
        const next = await fetchConversationSuggestions?.({
          exclude,
          generate,
        });
        if (requestGeneration.current !== thisGeneration) return;
        setSuggestions(Array.isArray(next) ? next : []);
      } finally {
        if (requestGeneration.current === thisGeneration) {
          setIsLoading(false);
        }
      }
    },
    [fetchConversationSuggestions]
  );

  useEffect(() => {
    if (!enabled) return undefined;
    const thisGeneration = requestGeneration.current;
    if (!shouldLoad) {
      // An existing thread whose messages have not arrived yet. Keep the
      // chips already on screen; paint local ones only if there are none.
      if (suggestions.length === 0) {
        loadSuggestions({ generate: false });
      }
      return undefined;
    }
    // Only the first opening list asks the avatar on its own (custom
    // starters drawn from the identity, cached per avatar). Every harvest
    // is a paid avatar turn, so after a reply the chips paint from the
    // identity-leaned local pool; the Re-roll button is the only way to
    // pay for a fresh harvest.
    loadSuggestions({
      generate: shouldGenerateConversationSuggestions({
        hasSpokenAvatarReply: Boolean(lastAvatarMessage),
        hasHumanTurn,
      }),
    });
    return () => {
      if (requestGeneration.current === thisGeneration) {
        requestGeneration.current += 1;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, suggestionKey]);

  const turnInFlight = pendingSendCount > 0;
  if (!shouldShowConversationSuggestions({ enabled })) {
    return null;
  }

  const sendSuggestion = (suggestion) => {
    if (turnInFlight) return;
    if (onSend) {
      onSend(suggestion);
      return;
    }
    handleSendMessageMediaContext(suggestion);
  };

  const toggleOpen = () => setSuggestionSheetOpen((open) => !open);

  const rerollSuggestions = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setSuggestionSheetOpen(true);
    // The one place a follow-up harvest is paid for: an explicit press.
    // Never blocked by a harvest in flight: the new request supersedes the
    // old one (its result is dropped by the generation counter).
    loadSuggestions({
      exclude: suggestions,
      generate: shouldGenerateConversationSuggestions({
        hasSpokenAvatarReply: Boolean(lastAvatarMessage),
        hasHumanTurn,
        requestedByUser: true,
      }),
    });
  };

  const sheetNoun = lastAvatarMessage
    ? 'suggested replies'
    : 'suggested starters';
  const menuId = overlay
    ? 'conversation-suggestions-menu-voice'
    : 'conversation-suggestions-menu';

  return (
    <div className="conversation-suggestions w-full overflow-visible mb-1">
      <div
        id={menuId}
        role="menu"
        aria-label={sheetNoun}
        hidden={!isOpen}
        className={suggestionSheetMenuClassName()}
      >
        {suggestions.length === 0 ? (
          <p className="px-3 py-2 text-sm text-white/40 italic">Suggestions…</p>
        ) : (
          suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              role="menuitem"
              disabled={turnInFlight}
              onClick={() => sendSuggestion(suggestion)}
              className="voice-text-btn w-full text-left px-3 py-2 rounded-lg text-sm text-white/80 hover:bg-white/10 hover:text-neutral-100 transition-colors disabled:opacity-40"
            >
              {suggestion}
            </button>
          ))
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onPointerDown={(pointerEvent) => {
            dragStartY.current = pointerEvent.clientY;
          }}
          onPointerUp={(pointerEvent) => {
            const startY = dragStartY.current;
            dragStartY.current = null;
            if (startY == null) return;
            const deltaY = pointerEvent.clientY - startY;
            if (deltaY < -24) {
              setSuggestionSheetOpen(true);
              return;
            }
            if (deltaY > 24) {
              setSuggestionSheetOpen(false);
              return;
            }
            toggleOpen();
          }}
          onClick={(clickEvent) => {
            // Keyboard activation has no pointer coordinates to swipe with.
            if (clickEvent.detail === 0) toggleOpen();
          }}
          title={isOpen ? `Hide ${sheetNoun}` : `Show ${sheetNoun}`}
          aria-label={isOpen ? `Hide ${sheetNoun}` : `Show ${sheetNoun}`}
          aria-expanded={isOpen}
          aria-controls={menuId}
          className="suggestions-handle voice-text-btn min-w-0 flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-white/50 hover:text-neutral-200 hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/50"
        >
          {isOpen ? (
            <ChevronDown className="w-4 h-4" aria-hidden="true" />
          ) : (
            <ChevronUp className="w-4 h-4" aria-hidden="true" />
          )}
          <span className="text-xs">
            {lastAvatarMessage ? 'Suggested replies' : 'Suggested starters'}
          </span>
        </button>
        <button
          type="button"
          onClick={rerollSuggestions}
          onPointerDown={(event) => event.stopPropagation()}
          aria-busy={isLoading}
          title={`Re-roll ${sheetNoun}`}
          aria-label={`Re-roll ${sheetNoun}`}
          className="voice-text-btn shrink-0 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-white/50 hover:text-neutral-200 hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/50"
        >
          <RefreshCw
            className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          <span className="text-xs hidden sm:inline">Re-roll</span>
        </button>
      </div>
    </div>
  );
};

export default ConversationSuggestions;
