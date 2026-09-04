/**
 * Detect and hide the JSON follow-up lists the suggestion harvest asked for.
 *
 * Those lists belong in the chips above the composer, not in the transcript.
 * A harvest that went out as a real /message turn made the avatar answer
 * "hey mom" with `["Hi! What's going on?", …]` instead of talking.
 */

export function parseConversationSuggestionList(text) {
  const raw = String(text ?? '').trim();
  if (!raw.startsWith('[') || !raw.endsWith(']')) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length < 2 || parsed.length > 6) {
      return null;
    }
    const suggestions = parsed
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter((entry) => entry && entry.length <= 160);
    return suggestions.length >= 2 ? suggestions : null;
  } catch {
    return null;
  }
}

export function isConversationSuggestionList(text) {
  return parseConversationSuggestionList(text) != null;
}

/**
 * Follow-up chips from the last real avatar reply, without another /message
 * turn. A second turn on the same assistant is what replaced the reply with
 * a JSON list.
 *
 * @param {Array} messages The open transcript.
 * @returns {string[]} Up to three short prompts the person might send next.
 */
export function localFollowUpSuggestions(messages) {
  const lastAvatar = [...(messages ?? [])].reverse().find((message) => {
    if (message.type !== 'ai' || message.isLoading || !message.content) {
      return false;
    }
    return !isConversationSuggestionList(message.content);
  });
  if (!lastAvatar) {
    return [];
  }
  if (/\?/.test(String(lastAvatar.content))) {
    return ['Yes', 'Not really', 'Can you tell me more?'];
  }
  return ['Tell me more', 'How do you feel about that?', 'What happened next?'];
}
