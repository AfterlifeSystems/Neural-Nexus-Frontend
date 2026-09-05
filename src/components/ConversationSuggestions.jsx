// src/components/ConversationSuggestions.jsx
//
// Prompts for the current thread, offered as a sheet above the composer.
// An empty new conversation gets starters; after a reply, follow-ups.
// The handle raises and lowers the list; pressing a prompt sends it as the
// next user turn. Voice mode and message mode share the open/closed flag,
// so switching medium does not put the list away.

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { useMedia, NEW_CONVERSATION_ID } from '../context/MediaContext';
import { isConversationSuggestionList } from '../services/conversationSuggestions';
import {
  getSuggestionSheetOpen,
  setSuggestionSheetOpen,
  shouldAutoOpenSuggestionSheet,
  shouldCollapseSuggestionSheetAfterSend,
  shouldLoadConversationSuggestions,
  shouldShowConversationSuggestions,
  subscribeSuggestionSheetOpen,
} from './conversationSuggestionSheet';

/**
 * @param {Object} parameters
 * @param {boolean} [parameters.enabled] When false, render nothing (shared
 *   opening-question screens already offer a starter).
 * @param {Function} [parameters.onSend] Send a prompt. Voice mode supplies this
 *   so a suggestion is spoken as a turn rather than typed into the chat
 *   composer.
 * @param {boolean} [parameters.overlay] Open the list upward over the parent
 *   instead of pushing layout (voice mode: the portrait must not jump).
 */
const ConversationSuggestions = ({ enabled = true, onSend, overlay = false }) => {
  const {
    messages,
    pendingSendCount,
    handleSendMessageMediaContext,
    fetchConversationSuggestions,
    activeConversation,
  } = useMedia();
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpenState] = useState(getSuggestionSheetOpen);
  const requestGeneration = useRef(0);
  const sheetRef = useRef(null);
  const dragStartY = useRef(null);

  useEffect(() => {
    setIsOpenState(getSuggestionSheetOpen());
    return subscribeSuggestionSheetOpen(setIsOpenState);
  }, []);

  const lastAvatarMessage = [...(messages ?? [])]
    .reverse()
    .find((message) => {
      if (message.type !== 'ai' || !message.content || message.isLoading) {
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
  const suggestionKey = `${activeConversation ?? 'none'}:${
    lastAvatarMessage?.id ?? (shouldLoad ? 'opening' : 'empty')
  }`;

  const loadSuggestions = useCallback(
    async ({ exclude = [] } = {}) => {
      const thisGeneration = ++requestGeneration.current;
      setIsLoading(true);
      try {
        const next = await fetchConversationSuggestions?.({ exclude });
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
    if (!shouldLoad) {
      setSuggestions([]);
      setIsLoading(false);
      return undefined;
    }
    if (
      shouldAutoOpenSuggestionSheet({
        hasSpokenAvatarReply: Boolean(lastAvatarMessage),
        hasHumanTurn,
      })
    ) {
      setSuggestionSheetOpen(true);
    }
    const thisGeneration = requestGeneration.current;
    loadSuggestions();
    return () => {
      if (requestGeneration.current === thisGeneration) {
        requestGeneration.current += 1;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, suggestionKey]);

  useLayoutEffect(() => {
    if (
      shouldCollapseSuggestionSheetAfterSend({
        hasSpokenAvatarReply: Boolean(lastAvatarMessage),
        hasHumanTurn,
      })
    ) {
      setSuggestionSheetOpen(false);
    }
  }, [hasHumanTurn, lastAvatarMessage]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleEscape = (keyEvent) => {
      if (keyEvent.key === 'Escape') setSuggestionSheetOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const turnInFlight = pendingSendCount > 0;
  if (
    !shouldShowConversationSuggestions({
      enabled,
      isLoading,
      suggestionCount: suggestions.length,
      pendingSendCount,
    })
  ) {
    return null;
  }

  const sendSuggestion = (suggestion) => {
    if (turnInFlight) return;
    setSuggestionSheetOpen(false);
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
    loadSuggestions({ exclude: suggestions });
  };

  const sheetNoun = lastAvatarMessage
    ? 'suggested replies'
    : 'suggested starters';
  const menuId = overlay
    ? 'conversation-suggestions-menu-voice'
    : 'conversation-suggestions-menu';

  return (
    <div
      ref={sheetRef}
      className={`conversation-suggestions w-full overflow-visible ${overlay ? 'relative mb-1' : 'mb-1'}`}
    >
      <div
        id={menuId}
        role="menu"
        hidden={!isOpen}
        className={`overflow-hidden rounded-xl border border-white/10 bg-black/70 backdrop-blur-lg p-1.5 ${
          overlay
            ? 'absolute bottom-full left-0 right-0 mb-1 z-30'
            : 'mb-1'
        }`}
      >
        {isLoading && suggestions.length === 0 ? (
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
          disabled={isLoading}
          title={`Re-roll ${sheetNoun}`}
          aria-label={`Re-roll ${sheetNoun}`}
          className="voice-text-btn shrink-0 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-white/50 hover:text-neutral-200 hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:opacity-40"
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
