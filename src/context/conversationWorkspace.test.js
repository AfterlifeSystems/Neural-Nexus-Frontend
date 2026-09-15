import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  forgetAllConversationWorkspaces,
  forgetConversationWorkspace,
  recalledConversationWorkspace,
  rememberConversationWorkspace,
} from './conversationWorkspace.js';

const contextDirectory = dirname(fileURLToPath(import.meta.url));

test('a remembered workspace comes back for that avatar only', () => {
  forgetAllConversationWorkspaces();
  rememberConversationWorkspace('maya-1', {
    messages: [{ id: 'm1' }],
    conversationList: [{ thread_id: 't1' }],
    activeConversation: 't1',
  });
  assert.deepEqual(recalledConversationWorkspace('maya-1'), {
    messages: [{ id: 'm1' }],
    conversationList: [{ thread_id: 't1' }],
    activeConversation: 't1',
  });
  assert.equal(recalledConversationWorkspace('maya-2'), null);
  forgetConversationWorkspace('maya-1');
  assert.equal(recalledConversationWorkspace('maya-1'), null);
});

test('recalling copies the workspace so later writes do not leak', () => {
  forgetAllConversationWorkspaces();
  const messages = [{ id: 'm1' }];
  rememberConversationWorkspace('maya-1', {
    messages,
    conversationList: [],
    activeConversation: null,
  });
  const recalled = recalledConversationWorkspace('maya-1');
  recalled.messages.push({ id: 'm2' });
  messages.push({ id: 'm3' });
  assert.deepEqual(recalledConversationWorkspace('maya-1').messages, [
    { id: 'm1' },
  ]);
});

test('MediaContext remembers the workspace when the open avatar changes', () => {
  const mediaSource = readFileSync(
    join(contextDirectory, 'MediaContext.jsx'),
    'utf8'
  );
  assert.match(mediaSource, /rememberConversationWorkspace/);
  assert.match(mediaSource, /recalledConversationWorkspace/);
});
