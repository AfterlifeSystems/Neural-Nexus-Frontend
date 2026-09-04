import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getSuggestionSheetOpen,
  resetSuggestionSheetOpenForTests,
  setSuggestionSheetOpen,
  shouldShowConversationSuggestions,
  subscribeSuggestionSheetOpen,
} from './conversationSuggestionSheet.js';

test('suggested replies stay visible while a turn is in flight', () => {
  assert.equal(
    shouldShowConversationSuggestions({
      enabled: true,
      isLoading: false,
      suggestionCount: 3,
      pendingSendCount: 2,
    }),
    true
  );
});

test('suggested replies stay visible while the next list is loading', () => {
  assert.equal(
    shouldShowConversationSuggestions({
      enabled: true,
      isLoading: true,
      suggestionCount: 0,
      pendingSendCount: 0,
    }),
    true
  );
});

test('suggested replies hide when there is nothing to offer', () => {
  assert.equal(
    shouldShowConversationSuggestions({
      enabled: true,
      isLoading: false,
      suggestionCount: 0,
    }),
    false
  );
  assert.equal(
    shouldShowConversationSuggestions({
      enabled: false,
      isLoading: false,
      suggestionCount: 3,
    }),
    false
  );
});

test('opening suggested replies in one mode is still open in the other', () => {
  resetSuggestionSheetOpenForTests();
  const voiceSeen = [];
  const messageSeen = [];
  const stopVoice = subscribeSuggestionSheetOpen((open) => voiceSeen.push(open));
  const stopMessage = subscribeSuggestionSheetOpen((open) =>
    messageSeen.push(open)
  );

  assert.equal(getSuggestionSheetOpen(), false);
  setSuggestionSheetOpen(true);

  assert.equal(getSuggestionSheetOpen(), true);
  assert.deepEqual(voiceSeen, [true]);
  assert.deepEqual(messageSeen, [true]);

  setSuggestionSheetOpen(false);
  assert.equal(getSuggestionSheetOpen(), false);
  assert.deepEqual(voiceSeen, [true, false]);
  assert.deepEqual(messageSeen, [true, false]);

  stopVoice();
  stopMessage();
  resetSuggestionSheetOpenForTests();
});
