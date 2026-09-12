import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  OPENING_SUGGESTION_STORAGE_KEY,
  SUGGESTION_PROMPT_MARKER,
  buildSuggestionHarvestPrompt,
  cachedOpeningSuggestions,
  conversationExcerptForSuggestions,
  isConversationSuggestionList,
  localFollowUpSuggestions,
  looksLikeLeakedModelJson,
  FOUNDATION_OPENING_STARTERS,
  FOUNDATION_STATEMENT_FOLLOW_UPS,
  GENERAL_NAMED_OPENING_STARTERS,
  OPENING_STARTERS,
  conversationSuggestionsLookGeneric,
  openingIdentityLean,
  openingStartersForAvatar,
  preferAvatarSpecificSuggestions,
  RECRUITER_OPENING_STARTERS,
  RECRUITER_QUESTION_FOLLOW_UPS,
  RECRUITER_STATEMENT_FOLLOW_UPS,
  RESTAURANT_OPENING_STARTERS,
  RESTAURANT_STATEMENT_FOLLOW_UPS,
  STATEMENT_FOLLOW_UPS,
  parseConversationSuggestionList,
  parseHarvestedSuggestions,
  rememberOpeningSuggestions,
  resetOpeningSuggestionCacheForTests,
} from './conversationSuggestions.js';

test('a JSON array of short prompts is a suggestion list', () => {
  const text =
    '["Hi! What’s going on?", "Are you okay?", "Do you want to talk about it?"]';
  const parsed = parseConversationSuggestionList(text);
  assert.deepEqual(parsed, [
    'Hi! What’s going on?',
    'Are you okay?',
    'Do you want to talk about it?',
  ]);
  assert.equal(isConversationSuggestionList(text), true);
});

test('ordinary avatar prose is not a suggestion list', () => {
  assert.equal(parseConversationSuggestionList('Hey sweetheart, how are you?'), null);
  assert.equal(isConversationSuggestionList('Hey sweetheart, how are you?'), false);
  assert.equal(
    parseConversationSuggestionList('[smiles] I missed you, kiddo.'),
    null
  );
});

test('leaked model JSON is a harvest prefix; a stage direction is not', () => {
  assert.equal(looksLikeLeakedModelJson('["Hi!", "Are you okay?"]'), true);
  assert.equal(looksLikeLeakedModelJson('{ "asserts_inaccurate_fact": true }'), true);
  assert.equal(looksLikeLeakedModelJson('[smiles] I missed you, kiddo.'), false);
  assert.equal(looksLikeLeakedModelJson('Hey sweetheart, how are you?'), false);
});

test('a single-item array is not treated as suggestions', () => {
  assert.equal(parseConversationSuggestionList('["only one"]'), null);
});

test('an empty transcript offers opening starters, not an empty list', () => {
  const starters = localFollowUpSuggestions([]);
  assert.deepEqual(starters, OPENING_STARTERS.slice(0, 3));
  assert.deepEqual(starters, localFollowUpSuggestions(undefined));
});

test('an empty transcript with an avatar leans on that identity, not generic greetings', () => {
  const nationalGuard = {
    assistant_id: 'guard-1',
    name: 'National Guard',
    description: 'U.S. Army National Guard recruiter.',
  };
  const starters = localFollowUpSuggestions([], { avatar: nationalGuard });
  assert.deepEqual(starters, openingStartersForAvatar(nationalGuard).slice(0, 3));
  assert.deepEqual(starters, RECRUITER_OPENING_STARTERS.slice(0, 3));
  assert.equal(starters.includes('Hey, how are you?'), false);
  assert.equal(
    starters.some((prompt) => /I'd like to get started with/.test(prompt)),
    false
  );
});

test('opening starters lean on what the avatar does, not get-started-with-name', () => {
  const mellowMushroom = {
    name: 'Mellow Mushroom',
    description: 'Pizza restaurant that takes dine-in and takeout orders.',
  };
  const starters = openingStartersForAvatar(mellowMushroom);
  assert.equal(openingIdentityLean(mellowMushroom), 'restaurant');
  assert.deepEqual(starters.slice(0, 3), RESTAURANT_OPENING_STARTERS.slice(0, 3));
  assert.equal(starters.includes('Hey, how are you?'), false);
  assert.equal(
    starters.some((prompt) => /I'd like to get started with/.test(prompt)),
    false
  );
});

test('a named avatar without a role does not flash get-started-with-name', () => {
  const starters = openingStartersForAvatar({ name: 'Alex' });
  assert.equal(openingIdentityLean({ name: 'Alex' }), 'general');
  assert.deepEqual(starters.slice(0, 3), GENERAL_NAMED_OPENING_STARTERS.slice(0, 3));
  assert.equal(starters.includes('Hey, how are you?'), false);
  assert.equal(
    starters.some((prompt) => /I'd like to get started with/.test(prompt)),
    false
  );
});

test('a portrait description is never pasted into an opening chip', () => {
  const avatar = {
    name: 'Evan',
    description:
      "I'm a woman with dark chestnut hair in soft shoulder-length waves and a warm smile.",
  };
  const starters = openingStartersForAvatar(avatar);
  assert.equal(openingIdentityLean(avatar), 'general');
  assert.deepEqual(starters.slice(0, 3), GENERAL_NAMED_OPENING_STARTERS.slice(0, 3));
  assert.equal(
    starters.some((prompt) => /I want to ask about/i.test(prompt)),
    false
  );
  assert.equal(starters.some((prompt) => /…|\.\.\./.test(prompt)), false);
  assert.equal(starters.some((prompt) => /chestnut hair/i.test(prompt)), false);
  assert.equal(
    conversationSuggestionsLookGeneric([
      'I want to ask about i’m a woman with dark chestnut hair in soft shoulder-le…',
      'What do people usually come to you for?',
      'How can you help me?',
    ]),
    true
  );
});

test('a harvest of old generic starters does not replace identity chips', () => {
  const fallback = ['I want to enlist', 'What are the requirements to join?', 'How do I become a recruit?'];
  assert.equal(
    conversationSuggestionsLookGeneric([
      'Hey, how are you?',
      'What should we talk about?',
      'I wanted to check in',
    ]),
    true
  );
  assert.deepEqual(
    preferAvatarSpecificSuggestions(
      ['Hey, how are you?', 'What should we talk about?', 'I wanted to check in'],
      fallback
    ),
    fallback
  );
  assert.deepEqual(
    preferAvatarSpecificSuggestions(
      ['I want to enlist', 'What MOS should I pick?', 'How do I talk to a recruiter?'],
      fallback
    ),
    ['I want to enlist', 'What MOS should I pick?', 'How do I talk to a recruiter?']
  );
});

test('session cache ignores a stored generic opening list', () => {
  resetOpeningSuggestionCacheForTests();
  const nationalGuard = {
    assistant_id: 'guard-1',
    name: 'National Guard',
    description: 'U.S. Army National Guard recruiter.',
  };
  rememberOpeningSuggestions(nationalGuard, [
    'Hey, how are you?',
    'What should we talk about?',
    'I wanted to check in',
  ]);
  assert.equal(cachedOpeningSuggestions(nationalGuard), null);
  rememberOpeningSuggestions(nationalGuard, [
    'I want to enlist',
    'What are the requirements to join?',
    'How do I become a recruit?',
  ]);
  assert.deepEqual(cachedOpeningSuggestions(nationalGuard), [
    'I want to enlist',
    'What are the requirements to join?',
    'How do I become a recruit?',
  ]);
  resetOpeningSuggestionCacheForTests();
});

test("Claire Wineland's first-paint chips lean on the foundation, not her name", () => {
  const starters = openingStartersForAvatar(CLAIRE_WINELAND);
  assert.equal(openingIdentityLean(CLAIRE_WINELAND), 'foundation');
  assert.deepEqual(starters.slice(0, 3), FOUNDATION_OPENING_STARTERS.slice(0, 3));
  assert.ok(starters.includes('Can you share the website?'));
});

test('a re-roll on an empty transcript skips the opening starters already shown', () => {
  const first = localFollowUpSuggestions([]);
  const rerolled = localFollowUpSuggestions([], { exclude: first });
  assert.equal(rerolled.length, 3);
  assert.equal(
    rerolled.some((prompt) => first.includes(prompt)),
    false
  );
});

test('local follow-ups come from a real reply, not a harvest list', () => {
  const messages = [
    { type: 'human', content: 'hey mom' },
    {
      type: 'ai',
      content: '["Hi! What’s going on?", "Are you okay?"]',
    },
    { type: 'ai', content: 'Hey kiddo, what’s going on?' },
  ];
  assert.deepEqual(localFollowUpSuggestions(messages), [
    'Yes',
    'Not really',
    'Can you tell me more?',
  ]);
});

test('follow-ups with an avatar lean on that identity, not Tell me more', () => {
  const nationalGuard = {
    assistant_id: 'guard-1',
    name: 'National Guard',
    description: 'U.S. Army National Guard recruiter.',
  };
  const statementMessages = [
    { type: 'human', content: 'I want to serve' },
    { type: 'ai', content: 'We have infantry and cyber openings this quarter.' },
  ];
  const questionMessages = [
    { type: 'human', content: 'I want to serve' },
    { type: 'ai', content: 'Are you ready to enlist?' },
  ];
  assert.deepEqual(
    localFollowUpSuggestions(statementMessages, { avatar: nationalGuard }),
    RECRUITER_STATEMENT_FOLLOW_UPS.slice(0, 3)
  );
  assert.deepEqual(
    localFollowUpSuggestions(questionMessages, { avatar: nationalGuard }),
    RECRUITER_QUESTION_FOLLOW_UPS.slice(0, 3)
  );
  assert.equal(
    localFollowUpSuggestions(statementMessages, { avatar: nationalGuard }).some(
      (prompt) => STATEMENT_FOLLOW_UPS.includes(prompt)
    ),
    false
  );
});

test('restaurant and foundation follow-ups stay on that work', () => {
  const pizzaReply = [
    { type: 'human', content: 'I am hungry' },
    { type: 'ai', content: 'The house pizza is our most ordered pie.' },
  ];
  const foundationReply = [
    { type: 'human', content: 'I want to help' },
    {
      type: 'ai',
      content: 'The foundation supports families living with cystic fibrosis.',
    },
  ];
  assert.deepEqual(
    localFollowUpSuggestions(pizzaReply, {
      avatar: {
        name: 'Mellow Mushroom',
        description: 'Pizza restaurant that takes dine-in and takeout orders.',
      },
    }),
    RESTAURANT_STATEMENT_FOLLOW_UPS.slice(0, 3)
  );
  assert.deepEqual(
    localFollowUpSuggestions(foundationReply, { avatar: CLAIRE_WINELAND }),
    FOUNDATION_STATEMENT_FOLLOW_UPS.slice(0, 3)
  );
});

test('a re-roll skips the prompts already on screen', () => {
  const messages = [
    { type: 'human', content: 'hey mom' },
    { type: 'ai', content: 'Hey kiddo, what’s going on?' },
  ];
  const first = localFollowUpSuggestions(messages);
  const rerolled = localFollowUpSuggestions(messages, { exclude: first });
  assert.equal(rerolled.length, 3);
  assert.equal(
    rerolled.some((prompt) => first.includes(prompt)),
    false
  );
});

test('a harvest excerpt is the spoken turns, not a leaked JSON list', () => {
  const excerpt = conversationExcerptForSuggestions([
    { type: 'human', content: 'hey mom' },
    {
      type: 'ai',
      content: '["Hi! What’s going on?", "Are you okay?"]',
    },
    { type: 'ai', content: 'Hey kiddo, what’s going on?' },
  ]);
  assert.match(excerpt, /Person: hey mom/);
  assert.match(excerpt, /Avatar: Hey kiddo/);
  assert.equal(excerpt.includes('Are you okay?'), false);
});

test('the harvest prompt asks for replies grounded in the conversation', () => {
  const messages = [
    { type: 'human', content: 'I got the job' },
    { type: 'ai', content: 'Oh honey, I am so proud of you.' },
  ];
  const prompt = buildSuggestionHarvestPrompt(messages, {
    exclude: ['Tell me more'],
    avatar: { name: 'Mom', description: 'A remembered grandmother.' },
  });
  assert.equal(prompt.startsWith(SUGGESTION_PROMPT_MARKER), true);
  assert.match(prompt, /I got the job/);
  assert.match(prompt, /so proud of you/);
  assert.match(prompt, /Do not repeat/);
  assert.match(prompt, /Tell me more/);
  assert.match(prompt, /avatar identity/);
  assert.match(prompt, /Do not offer generic prompts/);
  assert.match(prompt, /How do you feel about that/);
});

test('an opening harvest names the avatar identity and forbids generic greetings', () => {
  const prompt = buildSuggestionHarvestPrompt([], {
    avatar: {
      name: 'National Guard',
      description: 'U.S. Army National Guard recruiter.',
    },
  });
  assert.equal(prompt.startsWith(SUGGESTION_PROMPT_MARKER), true);
  assert.match(prompt, /Avatar name: National Guard/);
  assert.match(prompt, /recruiter/);
  assert.match(prompt, /Do not offer generic greetings/);
  assert.match(prompt, /hiring or joining/);
  assert.equal(prompt.includes('Person:'), false);
});

test('opening chips are remembered per avatar for the next empty chat', () => {
  resetOpeningSuggestionCacheForTests();
  const nationalGuard = {
    assistant_id: 'guard-1',
    name: 'National Guard',
    description: 'U.S. Army National Guard recruiter.',
  };
  rememberOpeningSuggestions(nationalGuard, [
    'I want to enlist',
    'What are the requirements to join?',
    'How do I become a recruit?',
  ]);
  assert.deepEqual(cachedOpeningSuggestions(nationalGuard), [
    'I want to enlist',
    'What are the requirements to join?',
    'How do I become a recruit?',
  ]);
  assert.equal(
    cachedOpeningSuggestions({
      assistant_id: 'pizza-1',
      name: 'Mellow Mushroom',
    }),
    null
  );
  resetOpeningSuggestionCacheForTests();
});

const CLAIRE_WINELAND = {
  assistant_id: 'claire-1',
  name: 'Claire Wineland',
  description:
    "Founder of Claire's Place Foundation, supporting families living with cystic fibrosis. https://clairesplacefoundation.org/",
};

const GRANT_IMAHARA = {
  assistant_id: 'grant-1',
  name: 'Grant Imahara',
  description:
    "Engineer and founder of Grant Imahara's STEAM Foundation. https://www.grantimaharafoundation.org/",
};

test("Claire Wineland's opening harvest names Claire's Place Foundation and its link", () => {
  const prompt = buildSuggestionHarvestPrompt([], { avatar: CLAIRE_WINELAND });
  assert.match(prompt, /Avatar name: Claire Wineland/);
  assert.match(prompt, /Claire's Place Foundation/);
  assert.match(prompt, /https:\/\/clairesplacefoundation\.org\//);
  assert.match(prompt, /Organization links:/);
  assert.match(prompt, /share that organization's public website link/);
});

test("Grant Imahara's opening harvest names the STEAM Foundation and its link", () => {
  const prompt = buildSuggestionHarvestPrompt([], { avatar: GRANT_IMAHARA });
  assert.match(prompt, /Avatar name: Grant Imahara/);
  assert.match(prompt, /STEAM Foundation/);
  assert.match(prompt, /https:\/\/www\.grantimaharafoundation\.org\//);
  assert.match(prompt, /Organization links:/);
  assert.match(prompt, /share that organization's public website link/);
});

test("Claire and Grant opening chips stay on their own avatar", () => {
  resetOpeningSuggestionCacheForTests();
  rememberOpeningSuggestions(CLAIRE_WINELAND, [
    "Tell me about Claire's Place Foundation",
    'Can you share the link to Claire’s Place Foundation?',
    'How can I support families living with CF?',
  ]);
  rememberOpeningSuggestions(GRANT_IMAHARA, [
    "Tell me about Grant Imahara's STEAM Foundation",
    'Can you share the link to the STEAM Foundation?',
    'How can I get involved with STEAM education?',
  ]);
  assert.match(
    cachedOpeningSuggestions(CLAIRE_WINELAND)[1],
    /Claire/
  );
  assert.match(
    cachedOpeningSuggestions(GRANT_IMAHARA)[1],
    /STEAM Foundation/
  );
  resetOpeningSuggestionCacheForTests();
});

test('harvested opening chips survive a reload through browser storage', () => {
  const store = new Map();
  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
  try {
    resetOpeningSuggestionCacheForTests();
    const harvested = [
      "Tell me about Claire's Place Foundation",
      'Can you share the link to Claire’s Place Foundation?',
      'How can I support families living with CF?',
    ];
    rememberOpeningSuggestions(CLAIRE_WINELAND, harvested);
    assert.equal(store.size, 1, 'the list is written to storage');

    // A reload empties the in-memory map but leaves storage alone.
    const stored = store.get(OPENING_SUGGESTION_STORAGE_KEY);
    resetOpeningSuggestionCacheForTests();
    store.set(OPENING_SUGGESTION_STORAGE_KEY, stored);

    assert.deepEqual(cachedOpeningSuggestions(CLAIRE_WINELAND), harvested);
    assert.equal(cachedOpeningSuggestions(GRANT_IMAHARA), null);
  } finally {
    resetOpeningSuggestionCacheForTests();
    globalThis.localStorage = previousStorage;
  }
});

test('a re-roll over a small pool always changes the visible chips', () => {
  const avatar = { assistant_id: 'plain-1', name: 'Evan', description: '' };
  const first = localFollowUpSuggestions([], { avatar });
  assert.deepEqual(first, GENERAL_NAMED_OPENING_STARTERS.slice(0, 3));
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const rerolled = localFollowUpSuggestions([], { avatar, exclude: first });
    assert.equal(rerolled.length, 3);
    assert.equal(new Set(rerolled).size, 3, 'no duplicates');
    const fresh = rerolled.filter((chip) => !first.includes(chip));
    assert.equal(
      fresh.length,
      GENERAL_NAMED_OPENING_STARTERS.length - 3,
      'every chip not yet shown is offered first'
    );
  }
});

test('a re-roll shows every unseen chip before repeating one', () => {
  const unnamedGeneral = { assistant_id: 'gen-1', name: 'Evan' };
  const first = localFollowUpSuggestions([], { avatar: unnamedGeneral });
  assert.equal(first.length, 3);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const rerolled = localFollowUpSuggestions([], {
      avatar: unnamedGeneral,
      exclude: first,
    });
    assert.equal(rerolled.length, 3);
    // The pool holds five chips: both unseen ones lead the new list.
    const unseen = rerolled.filter((chip) => !first.includes(chip));
    assert.equal(unseen.length, 2);
    assert.ok(!first.includes(rerolled[0]));
    assert.ok(!first.includes(rerolled[1]));
  }
});

test('harvested opening chips survive a reload through browser storage', () => {
  const store = new Map();
  const fakeStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
  const previousStorage = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', {
    value: fakeStorage,
    configurable: true,
    writable: true,
  });
  try {
    resetOpeningSuggestionCacheForTests();
    const chips = [
      'I want to enlist',
      'What are the requirements to join?',
      'Can you share the website?',
    ];
    rememberOpeningSuggestions(CLAIRE_WINELAND, chips);
    assert.ok(store.get(OPENING_SUGGESTION_STORAGE_KEY).includes('enlist'));
    // A new page load starts with an empty in-memory cache.
    resetOpeningSuggestionCacheForTests();
    rememberOpeningSuggestions(CLAIRE_WINELAND, chips);
    const reloaded = new Map(store);
    resetOpeningSuggestionCacheForTests();
    for (const [key, value] of reloaded) store.set(key, value);
    assert.deepEqual(cachedOpeningSuggestions(CLAIRE_WINELAND), chips);
  } finally {
    resetOpeningSuggestionCacheForTests();
    Object.defineProperty(globalThis, 'localStorage', {
      value: previousStorage,
      configurable: true,
      writable: true,
    });
  }
});

test('a harvest reply wrapped in a sentence still yields the list', () => {
  assert.deepEqual(
    parseHarvestedSuggestions(
      'Sure — ["That means a lot", "I start Monday", "I wanted you to hear it first"]'
    ),
    ['That means a lot', 'I start Monday', 'I wanted you to hear it first']
  );
  assert.deepEqual(parseHarvestedSuggestions('no list here'), []);
});
