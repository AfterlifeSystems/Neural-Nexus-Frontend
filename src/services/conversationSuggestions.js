/**
 * Detect and hide the JSON follow-up lists the suggestion harvest asked for.
 *
 * Those lists belong in the chips above the composer, not in the transcript.
 * A harvest that went out as a real /message turn made the avatar answer
 * "hey mom" with `["Hi! What's going on?", …]` instead of talking.
 */

import { avatarDescriptionOf } from './avatarMapMark.js';
import { organizationLinksFromAvatar } from './organizationLinks.js';

/** Prefix of the hidden turn that asks the avatar for follow-up suggestions. */
export const SUGGESTION_PROMPT_MARKER =
  '[neural-nexus:conversation-suggestions]';

const openingSuggestionCacheByAvatar = new Map();

/**
 * Browser storage key for harvested opening chips.
 *
 * A harvest is a full avatar turn and can take a minute. Keeping the last
 * good opening list per avatar across reloads means a returning visitor
 * sees identity-specific starters at once instead of the local pool.
 */
export const OPENING_SUGGESTION_STORAGE_KEY = 'neuralNexus.openingSuggestions.v1';
const OPENING_SUGGESTION_STORAGE_MAX_ENTRIES = 40;

function openingSuggestionStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function readStoredOpeningSuggestions() {
  const storage = openingSuggestionStorage();
  if (!storage) return {};
  try {
    const parsed = JSON.parse(storage.getItem(OPENING_SUGGESTION_STORAGE_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function writeStoredOpeningSuggestions(cacheKey, chips) {
  const storage = openingSuggestionStorage();
  if (!storage) return;
  try {
    const stored = readStoredOpeningSuggestions();
    delete stored[cacheKey];
    const entries = Object.entries(stored).slice(
      -(OPENING_SUGGESTION_STORAGE_MAX_ENTRIES - 1)
    );
    entries.push([cacheKey, chips]);
    storage.setItem(
      OPENING_SUGGESTION_STORAGE_KEY,
      JSON.stringify(Object.fromEntries(entries))
    );
  } catch {
    // Storage full or blocked; the in-memory cache still serves this session.
  }
}

/**
 * Name and description the chips should lean on, wherever the record keeps them.
 *
 * @param {Object|null|undefined} avatar The open avatar.
 * @returns {{name: string, description: string}}
 */
export function avatarIdentityForSuggestions(avatar) {
  const name = String(avatar?.name ?? '').trim();
  const description = avatarDescriptionOf(avatar);
  return { name, description };
}

/**
 * Cache key for opening chips: the avatar, plus the identity text those chips
 * were drawn from, so an edited description is not served last session's list.
 *
 * @param {Object|null|undefined} avatar The open avatar.
 * @returns {string}
 */
export function openingSuggestionCacheKey(avatar) {
  const assistantId =
    avatar?.assistant_id ?? avatar?.avatar_id ?? avatar?.id ?? '';
  const { name, description } = avatarIdentityForSuggestions(avatar);
  return `${assistantId}\n${name}\n${description}`;
}

/**
 * Opening chips already harvested for this avatar in this browser session.
 *
 * @param {Object|null|undefined} avatar The open avatar.
 * @returns {string[]|null}
 */
export function cachedOpeningSuggestions(avatar) {
  if (!avatar) return null;
  const cacheKey = openingSuggestionCacheKey(avatar);
  let cached = openingSuggestionCacheByAvatar.get(cacheKey) ?? null;
  if (!cached) {
    const stored = readStoredOpeningSuggestions()[cacheKey];
    if (
      Array.isArray(stored) &&
      stored.every((entry) => typeof entry === 'string')
    ) {
      cached = stored;
      openingSuggestionCacheByAvatar.set(cacheKey, stored);
    }
  }
  if (!cached || conversationSuggestionsLookGeneric(cached)) return null;
  return cached;
}

/**
 * Remember the latest opening list so a new empty chat with the same avatar
 * does not pay another harvest.
 *
 * @param {Object|null|undefined} avatar The open avatar.
 * @param {string[]} suggestions The harvested chips.
 */
export function rememberOpeningSuggestions(avatar, suggestions) {
  if (!avatar || !Array.isArray(suggestions) || suggestions.length < 2) {
    return;
  }
  const chips = suggestions.slice(0, 3);
  if (conversationSuggestionsLookGeneric(chips)) return;
  const cacheKey = openingSuggestionCacheKey(avatar);
  openingSuggestionCacheByAvatar.set(cacheKey, chips);
  writeStoredOpeningSuggestions(cacheKey, chips);
}

/** Test helper: drop session-cached and stored opening chips. */
export function resetOpeningSuggestionCacheForTests() {
  openingSuggestionCacheByAvatar.clear();
  try {
    openingSuggestionStorage()?.removeItem(OPENING_SUGGESTION_STORAGE_KEY);
  } catch {
    // No storage in this environment.
  }
}

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
 * @param {Object|null} [options.avatar] The open avatar; opening chips lean on this.
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

const GENERIC_SUGGESTION_TEXTS = new Set(
  [
    ...QUESTION_FOLLOW_UPS,
    ...STATEMENT_FOLLOW_UPS,
    ...OPENING_STARTERS,
  ].map((prompt) => prompt.toLowerCase())
);

/**
 * Whether a chip is one of the old any-avatar greetings or follow-ups.
 *
 * Harvest used to replace a recruiter or restaurant list with
 * "Hey, how are you?" / "Tell me more". Those must not win.
 *
 * @param {string} prompt One suggested message.
 * @returns {boolean}
 */
export function isGenericConversationSuggestion(prompt) {
  const text = String(prompt ?? '').trim().toLowerCase();
  if (!text) return true;
  if (GENERIC_SUGGESTION_TEXTS.has(text)) return true;
  if (/^i'?d like to get started with /.test(text)) return true;
  // A chip that pastes the avatar description (and often truncates it with
  // an ellipsis) is not a message anyone would type. The old first-paint
  // pool built "I want to ask about ${description…}" that way.
  if (/^i want to ask about /.test(text) && /(?:…|\.\.\.)$/.test(text)) {
    return true;
  }
  return false;
}

/**
 * Whether a harvested or cached list is the old generic pool.
 *
 * A single chip that pastes the avatar description (truncated with an
 * ellipsis) is enough to reject the list: that chip is never a real
 * starter, and keeping it on screen is what made people send a portrait
 * description as their opening message.
 *
 * @param {string[]|null|undefined} suggestions Candidate chips.
 * @returns {boolean}
 */
export function conversationSuggestionsLookGeneric(suggestions) {
  const list = (suggestions ?? []).filter(
    (entry) => typeof entry === 'string' && entry.trim()
  );
  if (list.length < 2) return true;
  if (
    list.some((entry) => {
      const text = String(entry).trim().toLowerCase();
      return (
        /^i want to ask about /.test(text) && /(?:…|\.\.\.)$/.test(text)
      );
    })
  ) {
    return true;
  }
  const genericCount = list.filter(isGenericConversationSuggestion).length;
  return genericCount >= 2;
}

/**
 * Keep harvest chips only when they are more specific than the local list.
 *
 * @param {string[]|null|undefined} harvested Model chips.
 * @param {string[]} fallback Identity-leaned local chips.
 * @returns {string[]}
 */
export function preferAvatarSpecificSuggestions(harvested, fallback) {
  const fallbackList = Array.isArray(fallback) ? fallback.slice(0, 3) : [];
  if (!Array.isArray(harvested) || harvested.length < 2) {
    return fallbackList;
  }
  const chips = harvested
    .map((entry) => String(entry).trim())
    .filter(Boolean)
    .slice(0, 3);
  if (conversationSuggestionsLookGeneric(chips)) {
    return fallbackList;
  }
  return chips;
}

export const RECRUITER_OPENING_STARTERS = [
  'I want to enlist',
  'What are the requirements to join?',
  'How do I become a recruit?',
  'What roles are you hiring for?',
  'Walk me through the next step to join',
];

export const RESTAURANT_OPENING_STARTERS = [
  "I'd like to place an order",
  'What do you recommend?',
  'Can I see the menu?',
  'What are you known for?',
  'I want to order takeout',
];

export const PASTOR_OPENING_STARTERS = [
  'Could we pray together?',
  'I could use a word of scripture',
  "What's on your heart today?",
  'Can you share a prayer with me?',
  'I came looking for guidance',
];

export const FOUNDATION_OPENING_STARTERS = [
  'Tell me about the foundation',
  'How can I support the work?',
  'Can you share the website?',
  'What does the foundation do?',
  'How can I get involved?',
];

export const LOVED_ONE_OPENING_STARTERS = [
  'I missed you',
  'I wanted to check in',
  'Tell me a story',
  'What have you been up to?',
  'What are you thinking about?',
];

export const GENERAL_NAMED_OPENING_STARTERS = [
  'What do people usually come to you for?',
  'How can you help me?',
  'What should I do first?',
  'What are you known for?',
  'I have a question about what you do',
];

const OPENING_WEBSITE_STARTER = 'Can you share the website?';

/**
 * How opening chips should lean, from the avatar name and description.
 *
 * Same leans the harvest prompt uses: enlist, order, pray, check in,
 * or the foundation's work. Used on the first paint so a recruiter does
 * not flash "I'd like to get started with National Guard" before the
 * harvest replaces it.
 *
 * @param {Object|null|undefined} avatar The open avatar.
 * @returns {'recruiter'|'restaurant'|'pastor'|'foundation'|'loved_one'|'general'}
 */
export function openingIdentityLean(avatar) {
  const { name, description } = avatarIdentityForSuggestions(avatar);
  const haystack = `${name} ${description}`.toLowerCase();
  if (
    /\b(recruit|enlist|national guard|army|navy|marines?|military)\b/.test(
      haystack
    )
  ) {
    return 'recruiter';
  }
  if (
    /\b(restaurant|pizza|menu|takeout|dine-in|diner|cafe|bistro)\b/.test(
      haystack
    )
  ) {
    return 'restaurant';
  }
  if (
    /\b(pastor|prayer|church|sermon|ministry|chapel|scripture)\b/.test(haystack)
  ) {
    return 'pastor';
  }
  if (/\bfoundation\b/.test(haystack)) {
    return 'foundation';
  }
  if (
    /\b(memorial|remembered|passed away|in loving memory|grandmother|grandfather|grandma|grandpa)\b/.test(
      haystack
    )
  ) {
    return 'loved_one';
  }
  return 'general';
}

function openingPoolForLean(lean, avatar) {
  switch (lean) {
    case 'recruiter':
      return RECRUITER_OPENING_STARTERS;
    case 'restaurant':
      return RESTAURANT_OPENING_STARTERS;
    case 'pastor':
      return PASTOR_OPENING_STARTERS;
    case 'foundation':
      return FOUNDATION_OPENING_STARTERS;
    case 'loved_one':
      return LOVED_ONE_OPENING_STARTERS;
    default:
      return generalOpeningStartersForAvatar(avatar);
  }
}

/**
 * First-paint chips for an avatar that does not match a known role.
 *
 * The old OPENING_STARTERS ("Hey, how are you?") fit every avatar. A named
 * or described identity must not fall back to that list. Never paste the
 * avatar description into a chip: a portrait description becomes
 * "I want to ask about i'm a woman with dark chestnut hair…", which is
 * not a starter anyone would type.
 *
 * @param {Object|null|undefined} avatar The open avatar.
 * @returns {string[]}
 */
export function generalOpeningStartersForAvatar(avatar) {
  const { name, description } = avatarIdentityForSuggestions(avatar);
  if (!name && !description) return OPENING_STARTERS;
  return [...GENERAL_NAMED_OPENING_STARTERS];
}

/**
 * Instant opening chips from the avatar record, used until a harvest returns.
 *
 * First paint must already lean on identity (enlist, order, pray, the
 * foundation). A name-templated "I'd like to get started with …" is not
 * a starter anyone would type. Harvest may replace this list; it must
 * not be the only source of a useful first chip.
 *
 * @param {Object|null|undefined} avatar The open avatar.
 * @returns {string[]}
 */
export function openingStartersForAvatar(avatar) {
  const { name, description } = avatarIdentityForSuggestions(avatar);
  if (!name && !description) return OPENING_STARTERS;

  const lean = openingIdentityLean(avatar);
  const pool = [...openingPoolForLean(lean, avatar)];
  const hasOrganizationLink = organizationLinksFromAvatar(avatar).length > 0;
  if (
    hasOrganizationLink &&
    !pool.some((prompt) => /website|site|link/i.test(prompt))
  ) {
    pool.splice(2, 0, OPENING_WEBSITE_STARTER);
  }
  return [...new Set(pool)];
}

const pickThree = (pool, exclude) => {
  const skipped = new Set(
    (exclude ?? []).map((entry) => String(entry).trim().toLowerCase())
  );
  const shuffle = (entries) => {
    const shuffled = [...entries];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapWith = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapWith]] = [
        shuffled[swapWith],
        shuffled[index],
      ];
    }
    return shuffled;
  };
  const remaining = pool.filter(
    (entry) => !skipped.has(entry.toLowerCase())
  );
  if (remaining.length >= 3) {
    return shuffle(remaining).slice(0, 3);
  }
  // A small pool: show every chip not on screen yet, then top up from the
  // ones being replaced so a re-roll always changes what is visible.
  const replaced = pool.filter((entry) => skipped.has(entry.toLowerCase()));
  return [...shuffle(remaining), ...shuffle(replaced)].slice(0, 3);
};

export const RECRUITER_STATEMENT_FOLLOW_UPS = [
  'What are the next steps to join?',
  'Tell me more about that role',
  'What should I bring?',
  'How long is the process?',
  'What does a typical week look like?',
];

export const RECRUITER_QUESTION_FOLLOW_UPS = [
  'Yes, I want to join',
  'What would that require?',
  'I have another question first',
  'What happens after I say yes?',
  'Who should I talk to next?',
];

export const RESTAURANT_STATEMENT_FOLLOW_UPS = [
  "I'll take that",
  'What else do you recommend?',
  'Add that to my order',
  'What comes with that?',
  'Can I get that to go?',
];

export const RESTAURANT_QUESTION_FOLLOW_UPS = [
  "Yes, I'll take that",
  'What are the sides?',
  'Something else from the menu',
  'How spicy is that?',
  'Can I get that to go?',
];

export const PASTOR_STATEMENT_FOLLOW_UPS = [
  'Amen',
  'Can we pray on that?',
  'Say more about that verse',
  'That speaks to me',
  'I needed to hear that',
];

export const PASTOR_QUESTION_FOLLOW_UPS = [
  'Yes, please',
  'Can we pray about it?',
  'I need to sit with that',
  'What scripture speaks to that?',
  'Walk with me through that',
];

export const FOUNDATION_STATEMENT_FOLLOW_UPS = [
  'How can I help with that?',
  'Can you share the website?',
  'Tell me more about that work',
  'How do I get involved?',
  'Who does that support?',
];

export const FOUNDATION_QUESTION_FOLLOW_UPS = [
  'Yes, I want to help',
  'Can you share the website?',
  'How do I get involved?',
  'Who does that support?',
  'What is the next step to help?',
];

export const LOVED_ONE_STATEMENT_FOLLOW_UPS = [
  'I missed that about you',
  'Tell me that story again',
  'How are you really?',
  'That sounds like you',
  'I wanted you to know I heard that',
];

export const LOVED_ONE_QUESTION_FOLLOW_UPS = [
  'Yes',
  'Not really',
  'I missed you',
  'Tell me more about that',
  'I want to hear your side',
];

export const GENERAL_STATEMENT_FOLLOW_UPS = [
  'What should I do with that?',
  'Can you walk me through that?',
  'What do people usually ask next?',
  'How does that work?',
  'What is the next step?',
];

export const GENERAL_QUESTION_FOLLOW_UPS = [
  'Yes',
  'Can you say more about that?',
  'What do you recommend?',
  'What is the next step?',
  'How do I get started on that?',
];

/**
 * Follow-up chips for a spoken avatar reply, leaned on that identity.
 *
 * Generic "Tell me more" / "How do you feel about that?" fit every avatar
 * and are what the sheet used to flash after every reply. With an avatar
 * record, the first paint must already sound like a visitor to this
 * identity. Harvest may replace the list; it must not be the only source
 * of a specific chip.
 *
 * @param {Object|null|undefined} avatar The open avatar.
 * @param {Object} [options]
 * @param {boolean} [options.askedQuestion] The last avatar line asked a question.
 * @returns {string[]}
 */
export function followUpPoolForAvatar(
  avatar,
  { askedQuestion = false } = {}
) {
  const lean = openingIdentityLean(avatar);
  switch (lean) {
    case 'recruiter':
      return askedQuestion
        ? RECRUITER_QUESTION_FOLLOW_UPS
        : RECRUITER_STATEMENT_FOLLOW_UPS;
    case 'restaurant':
      return askedQuestion
        ? RESTAURANT_QUESTION_FOLLOW_UPS
        : RESTAURANT_STATEMENT_FOLLOW_UPS;
    case 'pastor':
      return askedQuestion
        ? PASTOR_QUESTION_FOLLOW_UPS
        : PASTOR_STATEMENT_FOLLOW_UPS;
    case 'foundation':
      return askedQuestion
        ? FOUNDATION_QUESTION_FOLLOW_UPS
        : FOUNDATION_STATEMENT_FOLLOW_UPS;
    case 'loved_one':
      return askedQuestion
        ? LOVED_ONE_QUESTION_FOLLOW_UPS
        : LOVED_ONE_STATEMENT_FOLLOW_UPS;
    default:
      return askedQuestion
        ? GENERAL_QUESTION_FOLLOW_UPS
        : GENERAL_STATEMENT_FOLLOW_UPS;
  }
}

export function localFollowUpSuggestions(
  messages,
  { exclude = [], avatar = null } = {}
) {
  const lastAvatar = [...(messages ?? [])].reverse().find((message) => {
    if (message.type !== 'ai' || message.isLoading || !message.content) {
      return false;
    }
    return !isConversationSuggestionList(message.content);
  });
  const askedQuestion = lastAvatar
    ? /\?/.test(String(lastAvatar.content))
    : false;
  const pool = lastAvatar
    ? avatar
      ? followUpPoolForAvatar(avatar, { askedQuestion })
      : askedQuestion
        ? QUESTION_FOLLOW_UPS
        : STATEMENT_FOLLOW_UPS
    : openingStartersForAvatar(avatar);
  if (exclude.length === 0) {
    return pool.slice(0, 3);
  }
  return pickThree(pool, exclude);
}

const MAX_EXCERPT_MESSAGES = 12;
const MAX_EXCERPT_CHARS = 400;

function isUsableSuggestionContext(message) {
  if (!message?.content || message.isLoading) return false;
  if (
    message.type !== 'human' &&
    message.type !== 'user' &&
    message.type !== 'ai'
  ) {
    return false;
  }
  const text = String(message.content);
  if (text.startsWith('[neural-nexus:')) return false;
  if (message.type === 'ai' && isConversationSuggestionList(text)) {
    return false;
  }
  return true;
}

function clipExcerptText(text) {
  const trimmed = String(text).trim();
  return trimmed.length > MAX_EXCERPT_CHARS
    ? `${trimmed.slice(0, MAX_EXCERPT_CHARS)}…`
    : trimmed;
}

/**
 * Recent spoken turns, for a harvest that must not sit on the open thread.
 *
 * The excerpt is pasted into the prompt so the avatar can write follow-ups
 * without another /message on the conversation itself.
 *
 * @param {Array} messages The open transcript.
 * @returns {string} Speaker-labelled lines, or an empty string.
 */
export function conversationExcerptForSuggestions(messages) {
  return (messages ?? [])
    .filter(isUsableSuggestionContext)
    .slice(-MAX_EXCERPT_MESSAGES)
    .map((message) => {
      const speaker =
        message.type === 'human' || message.type === 'user'
          ? 'Person'
          : 'Avatar';
      return `${speaker}: ${clipExcerptText(message.content)}`;
    })
    .join('\n');
}

/**
 * The hidden-turn prompt that asks for three follow-ups from the transcript.
 *
 * @param {Array} messages The open transcript.
 * @param {Object} [options]
 * @param {string[]} [options.exclude] Prompts already on screen; do not repeat.
 * @param {Object|null} [options.avatar] The open avatar; openings name this identity.
 * @returns {string}
 */
export function buildSuggestionHarvestPrompt(
  messages,
  { exclude = [], avatar = null } = {}
) {
  const excerpt = conversationExcerptForSuggestions(messages);
  const skip = (exclude ?? []).map((entry) => String(entry).trim()).filter(Boolean);
  const skipBlock = skip.length
    ? `\n\nDo not repeat any of these already-shown prompts:\n${skip
        .map((prompt) => `- ${prompt}`)
        .join('\n')}`
    : '';
  const { name, description } = avatarIdentityForSuggestions(avatar);
  const organizationLinks = organizationLinksFromAvatar(avatar);
  const identityLines = [
    name ? `Avatar name: ${name}` : '',
    description ? `Avatar identity: ${description}` : '',
    organizationLinks.length
      ? `Organization links:\n${organizationLinks.map((href) => `- ${href}`).join('\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
  const identityBlock = identityLines
    ? `\n\nThe person is about to talk to this avatar:\n${identityLines}`
    : '';
  const task = excerpt
    ? (
        'Given this conversation, suggest three short messages the person ' +
        'might send next. Ground each message in the avatar identity and ' +
        'what the avatar does, and in what was just said. A recruiter leans ' +
        'toward hiring or joining. A restaurant leans toward placing or ' +
        'changing an order. A pastor leans toward prayer. A loved one leans ' +
        "toward checking in. A foundation founder leans toward that " +
        "foundation's work. Do not offer generic prompts that would fit any " +
        'avatar, such as "Tell me more" or "How do you feel about that?".'
      )
    : (
        'Suggest three short opening messages a visitor would type to start a ' +
        'conversation with this avatar. Ground each message in the avatar ' +
        'identity and what the avatar does. A recruiter leans toward hiring or ' +
        'joining. A restaurant leans toward placing an order. A pastor leans ' +
        'toward prayer. A loved one leans toward checking in. A foundation ' +
        "founder leans toward that foundation's work. When the avatar " +
        'represents an organization, at least one opening should ask the ' +
        "avatar to share that organization's public website link. Do not offer " +
        'generic greetings that would fit any avatar.'
      );
  return (
    `${SUGGESTION_PROMPT_MARKER} ${task} ` +
    'Each must be a natural reply they would type, as if speaking to this avatar. ' +
    `Reply with a JSON array of three strings and nothing else.${skipBlock}` +
    identityBlock +
    (excerpt ? `\n\n${excerpt}` : '')
  );
}

/**
 * Pull a suggestion list out of a harvest reply, even if the model wrapped
 * the JSON in a sentence.
 *
 * @param {string} text The avatar's reply.
 * @returns {string[]}
 */
export function parseHarvestedSuggestions(text) {
  const direct = parseConversationSuggestionList(text);
  if (direct) return direct.slice(0, 3);
  const raw = String(text ?? '').trim();
  const jsonStart = raw.indexOf('[');
  const jsonEnd = raw.lastIndexOf(']');
  if (jsonStart < 0 || jsonEnd <= jsonStart) return [];
  return (
    parseConversationSuggestionList(raw.slice(jsonStart, jsonEnd + 1))?.slice(
      0,
      3
    ) ?? []
  );
}
