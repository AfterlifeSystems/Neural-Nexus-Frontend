// src/components/ConversationSuggestions.jsx
//
// Clickable follow-up bubbles populated by the avatar from the current thread.
// They sit in the message area above the composer; pressing one sends that
// text as the next user turn.

import React, { useEffect, useRef, useState } from 'react';
import { useMedia } from '../context/MediaContext';

/**
 * @param {Object} parameters
 * @param {boolean} [parameters.enabled] When false, render nothing (shared
 *   opening-question screens already offer a starter).
 */
const ConversationSuggestions = ({ enabled = true }) => {
  const {
    messages,
    pendingSendCount,
    handleSendMessageMediaContext,
    fetchConversationSuggestions,
    activeConversation,
  } = useMedia();
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const requestGeneration = useRef(0);

  const lastAvatarMessage = [...(messages ?? [])]
    .reverse()
    .find((message) => {
      if (message.type !== 'ai' || !message.content || message.isLoading) {
        return false;
      }
      const text = String(message.content).trim();
      if (text.startsWith('[') && text.endsWith(']')) return false;
      return true;
    });
  const suggestionKey = `${activeConversation ?? 'new'}:${lastAvatarMessage?.id ?? 'empty'}`;

  useEffect(() => {
    if (!enabled) return undefined;
    if (pendingSendCount > 0) return undefined;
    if (!lastAvatarMessage) {
      setSuggestions([]);
      setIsLoading(false);
      return undefined;
    }
    const thisGeneration = ++requestGeneration.current;
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setSuggestions([]);
      try {
        const next = await fetchConversationSuggestions?.();
        if (cancelled || requestGeneration.current !== thisGeneration) return;
        setSuggestions(Array.isArray(next) ? next : []);
      } finally {
        if (!cancelled && requestGeneration.current === thisGeneration) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, suggestionKey, pendingSendCount]);

  if (!enabled || pendingSendCount > 0) return null;
  if (!isLoading && suggestions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-2 pb-3 justify-center">
      {isLoading && suggestions.length === 0 ? (
        <p className="text-xs text-white/40 italic">Suggestions…</p>
      ) : (
        suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => handleSendMessageMediaContext(suggestion)}
            className="max-w-full text-left px-3 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/15 text-neutral-200 text-sm transition-colors"
          >
            {suggestion}
          </button>
        ))
      )}
    </div>
  );
};

export default ConversationSuggestions;
