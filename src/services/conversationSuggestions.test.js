import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isConversationSuggestionList,
  localFollowUpSuggestions,
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
});

test('a single-item array is not treated as suggestions', () => {
  assert.equal(parseConversationSuggestionList('["only one"]'), null);
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
