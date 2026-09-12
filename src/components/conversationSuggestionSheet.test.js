import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getSuggestionSheetOpen,
  resetSuggestionSheetOpenForTests,
  setSuggestionSheetOpen,
  shouldAutoOpenSuggestionSheet,
  shouldCloseSuggestionSheetOnOutsideClick,
  shouldCollapseSuggestionSheetAfterSend,
  shouldGenerateConversationSuggestions,
  shouldLoadConversationSuggestions,
  shouldShowConversationSuggestions,
  suggestionSheetMenuClassName,
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

test('conversation suggestions are always on when enabled', () => {
  assert.equal(shouldShowConversationSuggestions(), true);
  assert.equal(
    shouldShowConversationSuggestions({
      enabled: true,
      isLoading: false,
      suggestionCount: 0,
      shouldLoad: false,
    }),
    true
  );
});

test('the open suggestion list stays in flow and does not cover the composer', () => {
  const menuClassName = suggestionSheetMenuClassName();
  assert.equal(menuClassName.includes('absolute'), false);
  assert.equal(menuClassName.includes('bottom-full'), false);
  assert.match(menuClassName, /\bmb-1\b/);
});

test('suggested replies hide only when the caller disables them', () => {
  assert.equal(
    shouldShowConversationSuggestions({
      enabled: false,
      isLoading: false,
      suggestionCount: 3,
    }),
    false
  );
});

test('the handle stays up while a new chat or follow-up is allowed to load', () => {
  assert.equal(
    shouldShowConversationSuggestions({
      enabled: true,
      isLoading: false,
      suggestionCount: 0,
      shouldLoad: true,
    }),
    true
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

test('the first opening list harvests custom starters on its own', () => {
  assert.equal(shouldGenerateConversationSuggestions(), true);
  assert.equal(
    shouldGenerateConversationSuggestions({
      hasSpokenAvatarReply: false,
      hasHumanTurn: false,
    }),
    true
  );
});

test('a spoken reply does not pay for a harvest on its own', () => {
  assert.equal(
    shouldGenerateConversationSuggestions({
      hasSpokenAvatarReply: true,
      hasHumanTurn: true,
    }),
    false
  );
  assert.equal(
    shouldGenerateConversationSuggestions({
      hasSpokenAvatarReply: false,
      hasHumanTurn: true,
    }),
    false
  );
});

test('pressing Re-roll is the only way to harvest after the opening list', () => {
  assert.equal(
    shouldGenerateConversationSuggestions({
      hasSpokenAvatarReply: true,
      hasHumanTurn: true,
      requestedByUser: true,
    }),
    true
  );
  assert.equal(
    shouldGenerateConversationSuggestions({
      hasSpokenAvatarReply: false,
      hasHumanTurn: false,
      requestedByUser: true,
    }),
    true
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
      isNewConversation: true,
      hasHumanTurn: false,
    }),
    true
  );
});

test('the first send folds the starters', () => {
  assert.equal(shouldCollapseSuggestionSheetAfterSend(), true);
  assert.equal(
    shouldAutoOpenSuggestionSheet({
      isNewConversation: true,
      hasHumanTurn: true,
    }),
    false
  );
});

test('follow-up chips do not raise themselves after the avatar speaks', () => {
  assert.equal(
    shouldAutoOpenSuggestionSheet({
      isNewConversation: false,
      hasHumanTurn: true,
    }),
    false
  );
});

test('an existing thread still loading does not flash the starters open', () => {
  assert.equal(
    shouldAutoOpenSuggestionSheet({
      isNewConversation: false,
      hasHumanTurn: false,
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

  // Always on: the shared sheet starts open.
  assert.equal(getSuggestionSheetOpen(), true);
  setSuggestionSheetOpen(false);

  assert.equal(getSuggestionSheetOpen(), false);
  assert.deepEqual(voiceSeen, [false]);
  assert.deepEqual(messageSeen, [false]);

  setSuggestionSheetOpen(true);
  assert.equal(getSuggestionSheetOpen(), true);
  assert.deepEqual(voiceSeen, [false, true]);
  assert.deepEqual(messageSeen, [false, true]);

  stopVoice();
  stopMessage();
  resetSuggestionSheetOpenForTests();
});

test('a click on the sheet itself does not close suggested replies', () => {
  assert.equal(
    shouldCloseSuggestionSheetOnOutsideClick({
      closest: (selector) =>
        selector === '.conversation-suggestions' ? {} : null,
    }),
    false
  );
});

test('a click in the composer or voice message bar does not close suggested replies', () => {
  assert.equal(
    shouldCloseSuggestionSheetOnOutsideClick({
      closest: (selector) =>
        selector === '[data-voice-message-bar]' ? {} : null,
    }),
    false
  );
  assert.equal(
    shouldCloseSuggestionSheetOnOutsideClick({
      closest: (selector) => (selector === '.chat-composer' ? {} : null),
    }),
    false
  );
});

test('a click elsewhere closes suggested replies', () => {
  assert.equal(
    shouldCloseSuggestionSheetOnOutsideClick({
      closest: () => null,
    }),
    true
  );
  assert.equal(shouldCloseSuggestionSheetOnOutsideClick(null), true);
});
