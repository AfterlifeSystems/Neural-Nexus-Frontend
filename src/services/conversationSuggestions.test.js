import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isConversationSuggestionList,
  localFollowUpSuggestions,
  looksLikeLeakedModelJson,
  OPENING_STARTERS,
  parseConversationSuggestionList,
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
