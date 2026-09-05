import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getSuggestionSheetOpen,
  resetSuggestionSheetOpenForTests,
  setSuggestionSheetOpen,
  shouldAutoOpenSuggestionSheet,
  shouldCollapseSuggestionSheetAfterSend,
  shouldLoadConversationSuggestions,
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

test('a new conversation loads starters before anyone has spoken', () => {
  assert.equal(
    shouldLoadConversationSuggestions({
      hasSpokenAvatarReply: false,
      isNewConversation: true,
      hasHumanTurn: false,
    }),
    true
  );
});

test('an existing thread still loading does not load opening starters', () => {
  assert.equal(
    shouldLoadConversationSuggestions({
      hasSpokenAvatarReply: false,
      isNewConversation: false,
      hasHumanTurn: false,
    }),
    false
  );
});

test('a first human turn still in flight keeps starters available', () => {
  assert.equal(
    shouldLoadConversationSuggestions({
      hasSpokenAvatarReply: false,
      isNewConversation: false,
      hasHumanTurn: true,
    }),
    true
  );
});

test('an empty new chat auto-opens starters', () => {
  assert.equal(
    shouldAutoOpenSuggestionSheet({
      hasSpokenAvatarReply: false,
      hasHumanTurn: false,
    }),
    true
  );
});

test('the first send folds starters and does not auto-open them again', () => {
  assert.equal(
    shouldCollapseSuggestionSheetAfterSend({
      hasSpokenAvatarReply: false,
      hasHumanTurn: true,
    }),
    true
  );
  assert.equal(
    shouldAutoOpenSuggestionSheet({
      hasSpokenAvatarReply: false,
      hasHumanTurn: true,
    }),
    false
  );
});

test('follow-up chips stay as the person left them after a later send', () => {
  assert.equal(
    shouldCollapseSuggestionSheetAfterSend({
      hasSpokenAvatarReply: true,
      hasHumanTurn: true,
    }),
    false
  );
  assert.equal(
    shouldAutoOpenSuggestionSheet({
      hasSpokenAvatarReply: true,
      hasHumanTurn: true,
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
