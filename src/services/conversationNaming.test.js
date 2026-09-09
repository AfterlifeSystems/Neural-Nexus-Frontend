import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AUTOMATIC_TITLE_SOURCE,
  MANUAL_TITLE_SOURCE,
  manualRenameMetadata,
  overlayConversationNames,
  withConversationName,
} from './conversationNaming.js';

test('a name is written into nested thread metadata without losing the rest', () => {
  const named = withConversationName(
    {
      thread_id: 'thread-1',
      metadata: {
        pinned: true,
        thread_metadata: { user_id: 'user-1', shared: true },
      },
    },
    'Broken deployment pipeline'
  );
  assert.equal(
    named.metadata.thread_metadata.conversation_title,
    'Broken deployment pipeline'
  );
  assert.equal(
    named.metadata.thread_metadata.conversation_title_source,
    AUTOMATIC_TITLE_SOURCE
  );
  assert.equal(named.metadata.thread_metadata.user_id, 'user-1');
  assert.equal(named.metadata.thread_metadata.shared, true);
  assert.equal(named.metadata.pinned, true);
});

test('a listing that came back unnamed is named from what this session learned', () => {
  const threads = [
    { thread_id: 'thread-1', metadata: { thread_metadata: {} } },
    { thread_id: 'thread-2', metadata: { thread_metadata: {} } },
  ];
  const overlaid = overlayConversationNames(
    threads,
    new Map([['thread-1', 'Weekend trip to Lisbon']])
  );
  assert.equal(
    overlaid[0].metadata.thread_metadata.conversation_title,
    'Weekend trip to Lisbon'
  );
  assert.equal(
    overlaid[1].metadata.thread_metadata.conversation_title,
    undefined
  );
});

test('a name the server already returned wins over a remembered one', () => {
  const overlaid = overlayConversationNames(
    [
      {
        thread_id: 'thread-1',
        metadata: { thread_metadata: { conversation_title: 'My own name' } },
      },
    ],
    new Map([['thread-1', 'A generated name']])
  );
  assert.equal(
    overlaid[0].metadata.thread_metadata.conversation_title,
    'My own name'
  );
});

test('a thread named after itself counts as unnamed', () => {
  const overlaid = overlayConversationNames(
    [
      {
        thread_id: 'thread-1',
        metadata: { thread_metadata: { conversation_title: 'thread-1' } },
      },
    ],
    new Map([['thread-1', 'A generated name']])
  );
  assert.equal(
    overlaid[0].metadata.thread_metadata.conversation_title,
    'A generated name'
  );
});

test('a rename the reader typed is stamped as the reader’s own', () => {
  assert.deepEqual(manualRenameMetadata('Dinner plans'), {
    thread_metadata: {
      conversation_title: 'Dinner plans',
      conversation_title_source: MANUAL_TITLE_SOURCE,
    },
  });
});
