import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CONVERSATION_EXPORT_FORMAT_VERSION,
  buildConversationExport,
  conversationExportFilename,
  serializeConversationExport,
  shouldOfferConversationJsonDownload,
} from './conversationExport.js';

const THREAD_ID = '0a395674-f3a4-4cf3-bce9-8b68ee19a84d';

test('the JSON download is offered only in development on a real thread', () => {
  assert.equal(
    shouldOfferConversationJsonDownload({ isDev: true, threadId: THREAD_ID }),
    true
  );
  assert.equal(
    shouldOfferConversationJsonDownload({ isDev: false, threadId: THREAD_ID }),
    false
  );
  assert.equal(
    shouldOfferConversationJsonDownload({ isDev: true, threadId: '__new__' }),
    false
  );
  assert.equal(
    shouldOfferConversationJsonDownload({ isDev: true, threadId: null }),
    false
  );
});

test('the file name carries the thread id and a filesystem-safe timestamp', () => {
  const filename = conversationExportFilename({
    threadId: THREAD_ID,
    exportedAt: new Date('2026-09-11T20:15:30.123Z'),
  });
  assert.equal(
    filename,
    `conversation-${THREAD_ID}-2026-09-11T20-15-30-123.json`
  );
  assert.equal(/[:.]/.test(filename.replace(/\.json$/, '')), false);
});

test('the export keeps both the raw server body and the rendered transcript', () => {
  const serverResponse = {
    messages: [{ type: 'human', content: 'hi' }, { type: 'ai', content: 'hey' }],
    pending_interrupt: null,
  };
  const clientMessages = [
    { id: 'm1', type: 'human', content: 'hi' },
    { id: 'm2', type: 'ai', content: 'hey', sentiment: 'joy' },
  ];
  const exported = buildConversationExport({
    threadId: THREAD_ID,
    assistantId: 'asst_1',
    conversation: { thread_id: THREAD_ID, metadata: { pinned: true } },
    serverResponse,
    clientMessages,
    exportedAt: new Date('2026-09-11T20:15:30Z'),
  });

  assert.equal(exported.format, 'neural-nexus.conversation');
  assert.equal(exported.formatVersion, CONVERSATION_EXPORT_FORMAT_VERSION);
  assert.equal(exported.threadId, THREAD_ID);
  assert.equal(exported.assistantId, 'asst_1');
  assert.deepEqual(exported.server, serverResponse);
  assert.equal(exported.client.messageCount, 2);
  assert.deepEqual(exported.client.messages, clientMessages);
  assert.equal(exported.exportedAt, '2026-09-11T20:15:30.000Z');
});

test('serializing replaces object URLs so the file stays valid JSON', () => {
  const text = serializeConversationExport(
    buildConversationExport({
      threadId: THREAD_ID,
      clientMessages: [
        { id: 'm1', type: 'human', content: 'look', media: [{ url: 'blob:https://x/abc' }] },
      ],
    })
  );
  const parsed = JSON.parse(text);
  assert.deepEqual(parsed.client.messages[0].media[0].url, {
    $objectUrl: 'blob:https://x/abc',
  });
});
