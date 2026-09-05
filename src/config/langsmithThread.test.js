import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_LANGSMITH_ORG_ID,
  DEFAULT_LANGSMITH_PROJECT_ID,
  LANGSMITH_ORIGIN,
  buildLangsmithThreadUrl,
  isRealConversationThread,
  shouldOfferLangsmithThreadLink,
  shortenThreadId,
} from './langsmithThread.js';

const THREAD_ID = '0a395674-f3a4-4cf3-bce9-8b68ee19a84d';

test('a placeholder or empty id is not a conversation thread', () => {
  assert.equal(isRealConversationThread(null), false);
  assert.equal(isRealConversationThread(''), false);
  assert.equal(isRealConversationThread('__new__'), false);
  assert.equal(isRealConversationThread(THREAD_ID), true);
});

test('the LangSmith URL opens the Threads view on this conversation', () => {
  const href = buildLangsmithThreadUrl({ threadId: THREAD_ID });
  const url = new URL(href);

  assert.equal(url.origin, LANGSMITH_ORIGIN);
  assert.equal(
    url.pathname,
    `/o/${DEFAULT_LANGSMITH_ORG_ID}/projects/p/${DEFAULT_LANGSMITH_PROJECT_ID}`
  );
  assert.equal(url.searchParams.get('runview'), 'threads');
  assert.equal(url.searchParams.get('peekedConversationId'), THREAD_ID);
  assert.equal(url.searchParams.get('conversationTab'), 'trace');
  assert.equal(url.searchParams.get('searchModel'), '{}');
  assert.equal(url.searchParams.get('run_id'), null);
});

test('a run id is added when one is known', () => {
  const href = buildLangsmithThreadUrl({
    threadId: THREAD_ID,
    runId: '01a06edc-8a1b-7f03-8f32-f939587111cc',
  });
  assert.equal(
    new URL(href).searchParams.get('run_id'),
    '01a06edc-8a1b-7f03-8f32-f939587111cc'
  );
});

test('a missing org, project, or thread produces no URL', () => {
  assert.equal(buildLangsmithThreadUrl({ threadId: '__new__' }), null);
  assert.equal(buildLangsmithThreadUrl({ threadId: '' }), null);
  assert.equal(
    buildLangsmithThreadUrl({ threadId: THREAD_ID, orgId: '   ' }),
    null
  );
  assert.equal(
    buildLangsmithThreadUrl({ threadId: THREAD_ID, projectId: '' }),
    null
  );
});

test('the debug link is only for the administrator in development', () => {
  assert.equal(
    shouldOfferLangsmithThreadLink({
      isDev: true,
      isAdmin: true,
      threadId: THREAD_ID,
    }),
    true
  );
  assert.equal(
    shouldOfferLangsmithThreadLink({
      isDev: false,
      isAdmin: true,
      threadId: THREAD_ID,
    }),
    false
  );
  assert.equal(
    shouldOfferLangsmithThreadLink({
      isDev: true,
      isAdmin: false,
      threadId: THREAD_ID,
    }),
    false
  );
  assert.equal(
    shouldOfferLangsmithThreadLink({
      isDev: true,
      isAdmin: true,
      threadId: '__new__',
    }),
    false
  );
});

test('a long thread id is shortened for the label', () => {
  assert.equal(shortenThreadId(THREAD_ID), '0a395674…');
  assert.equal(shortenThreadId('abcd'), 'abcd');
  assert.equal(shortenThreadId(''), '');
});
