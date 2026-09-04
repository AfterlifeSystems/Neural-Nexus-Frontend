import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  conversationChronologicalTime,
  isConversationPinned,
  sortConversationsChronologically,
} from './pinnedConversations.js';

test('chronological time prefers created_at so a pin bump cannot win', () => {
  const conversation = {
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-09-03T00:00:00.000Z',
  };
  assert.equal(
    conversationChronologicalTime(conversation),
    Date.parse('2026-01-01T00:00:00.000Z')
  );
});

test('pinning and unpinning keep the same newest-created order', () => {
  const older = {
    thread_id: 'older',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-09-03T12:00:00.000Z',
    metadata: { pinned: true },
  };
  const newer = {
    thread_id: 'newer',
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
    metadata: { pinned: false },
  };
  const unpinnedOlder = {
    ...older,
    metadata: { pinned: false },
    updated_at: '2026-09-03T12:05:00.000Z',
  };

  const pinnedOrder = sortConversationsChronologically([older, newer]).map(
    (conversation) => conversation.thread_id
  );
  const unpinnedOrder = sortConversationsChronologically([
    unpinnedOlder,
    newer,
  ]).map((conversation) => conversation.thread_id);

  assert.deepEqual(pinnedOrder, ['newer', 'older']);
  assert.deepEqual(unpinnedOrder, ['newer', 'older']);
  assert.equal(isConversationPinned(older), true);
  assert.equal(isConversationPinned(unpinnedOlder), false);
});
