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
 * Whether streamed text is the start of leaked model JSON, not speech.
 *
 * A spoken line may open with a stage direction (`[smiles] I missed you`).
 * Treating every `[` as a harvest list hid that reply, then posted the
 * user's words again — two identical human turns and no avatar bubble.
 *
 * @param {string} text The tokens seen so far.
 * @returns {boolean}
 */
export function looksLikeLeakedModelJson(text) {
  const trimmed = String(text ?? '').trimStart();
  if (trimmed.startsWith('{')) {
    return true;
  }
  if (!trimmed.startsWith('[')) {
    return false;
  }
  const afterBracket = trimmed.slice(1).trimStart();
  return (
    afterBracket.startsWith('"') ||
    afterBracket.startsWith("'") ||
    afterBracket.startsWith('[')
  );
}

/**
 * Chips for the composer, without another /message turn. A second turn on
 * the same assistant is what replaced the reply with a JSON list.
 *
 * An empty transcript gets opening starters. After a real avatar reply, the
 * chips are follow-ups drawn from that line. The first draw is a stable
 * default. Passing `exclude` (the set already on screen) picks three
 * different prompts from the same pool, which is how "Re-roll" refreshes
 * the list without asking the avatar to speak JSON.
 *
 * @param {Array} messages The open transcript.
 * @param {Object} [options]
 * @param {string[]} [options.exclude] Prompts already shown; skip these on a re-roll.
 * @returns {string[]} Up to three short prompts the person might send next.
 */
export const QUESTION_FOLLOW_UPS = [
  'Yes',
  'Not really',
  'Can you tell me more?',
  'Tell me why',
  'What do you think I should do?',
  'Say more about that',
  'That makes sense',
  'Can we talk about something else?',
  'I need a minute',
];

export const STATEMENT_FOLLOW_UPS = [
  'Tell me more',
  'How do you feel about that?',
  'What happened next?',
  'Why do you say that?',
  'Remind me of a story',
  'What should we talk about?',
  'What would you do?',
  'Can we go deeper?',
  'That reminds me of something',
];

export const OPENING_STARTERS = [
  'Hey, how are you?',
  'What should we talk about?',
  'I wanted to check in',
  'Tell me a story',
  'What have you been up to?',
  'Can I ask you something?',
  'I missed you',
  'What are you thinking about?',
  'Help me think something through',
];

const pickThree = (pool, exclude) => {
  const skipped = new Set(
    (exclude ?? []).map((entry) => String(entry).trim().toLowerCase())
  );
  const remaining = pool.filter(
    (entry) => !skipped.has(entry.toLowerCase())
  );
  const source = remaining.length >= 3 ? remaining : pool;
  const shuffled = [...source];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapWith]] = [shuffled[swapWith], shuffled[index]];
  }
  return shuffled.slice(0, 3);
};

export function localFollowUpSuggestions(messages, { exclude = [] } = {}) {
  const lastAvatar = [...(messages ?? [])].reverse().find((message) => {
    if (message.type !== 'ai' || message.isLoading || !message.content) {
      return false;
    }
    return !isConversationSuggestionList(message.content);
  });
  const pool = lastAvatar
    ? /\?/.test(String(lastAvatar.content))
      ? QUESTION_FOLLOW_UPS
      : STATEMENT_FOLLOW_UPS
    : OPENING_STARTERS;
  if (exclude.length === 0) {
    return pool.slice(0, 3);
  }
  return pickThree(pool, exclude);
}
