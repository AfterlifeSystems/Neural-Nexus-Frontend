import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LANGSMITH_ORIGIN,
  buildLangsmithThreadUrl,
  isRealConversationThread,
  langsmithLocationOf,
  langsmithLookupOf,
  shouldOfferLangsmithThreadLink,
  shortenThreadId,
} from './langsmithThread.js';

const THREAD_ID = '0a395674-f3a4-4cf3-bce9-8b68ee19a84d';
const WORKSPACE_ID = 'f0d930e2-b7c3-462e-8faa-8320f2a735b1';
const PRODUCTION_PROJECT_ID = '75a95ebc-1f86-421a-a9e9-0441b25d75ed';
const LOCAL_TESTING_PROJECT_ID = 'aea5ce01-cd9f-498a-859c-ad0facb45f35';
const RUN_ID = 'e309fc6a-b75d-4fe5-bb0c-6527e8f0343e';

function replyTracedTo(projectId, projectName) {
  return {
    type: 'ai',
    response_metadata: {
      langsmith: {
        workspace_id: WORKSPACE_ID,
        project_id: projectId,
        project_name: projectName,
        run_id: RUN_ID,
      },
    },
  };
}

test('a placeholder or empty id is not a conversation thread', () => {
  assert.equal(isRealConversationThread(null), false);
  assert.equal(isRealConversationThread(''), false);
  assert.equal(isRealConversationThread('__new__'), false);
  assert.equal(isRealConversationThread(THREAD_ID), true);
});

test('the LangSmith URL opens the Threads view on this conversation', () => {
  const href = buildLangsmithThreadUrl({
    workspaceId: WORKSPACE_ID,
    projectId: PRODUCTION_PROJECT_ID,
    threadId: THREAD_ID,
  });
  const url = new URL(href);

  assert.equal(url.origin, LANGSMITH_ORIGIN);
  assert.equal(
    url.pathname,
    `/o/${WORKSPACE_ID}/projects/p/${PRODUCTION_PROJECT_ID}`
  );
  assert.equal(url.searchParams.get('runview'), 'threads');
  assert.equal(url.searchParams.get('peekedConversationId'), THREAD_ID);
  assert.equal(url.searchParams.get('conversationTab'), 'trace');
  assert.equal(url.searchParams.get('searchModel'), '{}');
  assert.equal(url.searchParams.get('run_id'), null);
});

test('a run id is added when one is known', () => {
  const href = buildLangsmithThreadUrl({
    workspaceId: WORKSPACE_ID,
    projectId: PRODUCTION_PROJECT_ID,
    threadId: THREAD_ID,
    runId: RUN_ID,
  });
  assert.equal(new URL(href).searchParams.get('run_id'), RUN_ID);
});

test('a missing workspace, project, or thread produces no URL', () => {
  const location = {
    workspaceId: WORKSPACE_ID,
    projectId: PRODUCTION_PROJECT_ID,
  };
  assert.equal(
    buildLangsmithThreadUrl({ ...location, threadId: '__new__' }),
    null
  );
  assert.equal(buildLangsmithThreadUrl({ ...location, threadId: '' }), null);
  assert.equal(
    buildLangsmithThreadUrl({
      ...location,
      threadId: THREAD_ID,
      workspaceId: '   ',
    }),
    null
  );
  assert.equal(
    buildLangsmithThreadUrl({
      ...location,
      threadId: THREAD_ID,
      projectId: '',
    }),
    null
  );
  // No built-in default project: a guessed project is how a production reply
  // used to open the local-testing project, or neither.
  assert.equal(buildLangsmithThreadUrl({ threadId: THREAD_ID }), null);
});

test('each reply links to the project the API traced the reply to', () => {
  const productionReply = replyTracedTo(PRODUCTION_PROJECT_ID, 'anubis');
  const localTestingReply = replyTracedTo(
    LOCAL_TESTING_PROJECT_ID,
    'anubis-local-testing'
  );

  const productionLocation = langsmithLocationOf(productionReply);
  const productionUrl = new URL(
    buildLangsmithThreadUrl({ ...productionLocation, threadId: THREAD_ID })
  );
  assert.equal(
    productionUrl.pathname,
    `/o/${WORKSPACE_ID}/projects/p/${PRODUCTION_PROJECT_ID}`
  );
  assert.equal(productionUrl.searchParams.get('run_id'), RUN_ID);
  assert.equal(productionLocation.projectName, 'anubis');

  const localTestingLocation = langsmithLocationOf(localTestingReply);
  const localTestingUrl = new URL(
    buildLangsmithThreadUrl({ ...localTestingLocation, threadId: THREAD_ID })
  );
  assert.equal(
    localTestingUrl.pathname,
    `/o/${WORKSPACE_ID}/projects/p/${LOCAL_TESTING_PROJECT_ID}`
  );
});

test('a reply without a recorded LangSmith location has no location', () => {
  assert.equal(langsmithLocationOf(null), null);
  assert.equal(langsmithLocationOf({ type: 'human' }), null);
  assert.equal(
    langsmithLocationOf({ response_metadata: { langsmith: 'anubis' } }),
    null
  );
  assert.equal(
    langsmithLocationOf({
      response_metadata: { langsmith: { workspace_id: WORKSPACE_ID } },
    }),
    null
  );
});

test('the run falls back to the live done frame run id', () => {
  const liveReply = {
    run_id: RUN_ID,
    response_metadata: {
      langsmith: {
        workspace_id: WORKSPACE_ID,
        project_id: PRODUCTION_PROJECT_ID,
      },
    },
  };
  assert.equal(langsmithLocationOf(liveReply).runId, RUN_ID);
});

test('the debug link is offered to every account in development only', () => {
  assert.equal(
    shouldOfferLangsmithThreadLink({ isDev: true, threadId: THREAD_ID }),
    true
  );
  assert.equal(
    shouldOfferLangsmithThreadLink({ isDev: false, threadId: THREAD_ID }),
    false
  );
  assert.equal(
    shouldOfferLangsmithThreadLink({ isDev: true, threadId: '__new__' }),
    false
  );
});

test('a long thread id is shortened for the label', () => {
  assert.equal(shortenThreadId(THREAD_ID), '0a395674…');
  assert.equal(shortenThreadId('abcd'), 'abcd');
  assert.equal(shortenThreadId(''), '');
});

test('a production reply without a record names the human turn to look up', () => {
  const productionReply = {
    type: 'ai',
    response_metadata: {
      langsmith_lookup: {
        human_message_id: 'b100a7ce-e51c-4ac5-af69-4529f5b680f1',
        human_created_at: '2026-09-28T15:53:54+00:00',
      },
    },
  };
  assert.equal(langsmithLocationOf(productionReply), null);
  assert.deepEqual(langsmithLookupOf(productionReply), {
    humanMessageId: 'b100a7ce-e51c-4ac5-af69-4529f5b680f1',
    humanCreatedAt: '2026-09-28T15:53:54+00:00',
  });
  assert.deepEqual(
    langsmithLookupOf({
      response_metadata: { langsmith_lookup: { human_message_id: 'human-1' } },
    }),
    { humanMessageId: 'human-1', humanCreatedAt: null }
  );
  assert.equal(langsmithLookupOf({ response_metadata: {} }), null);
  assert.equal(
    langsmithLookupOf({ response_metadata: { langsmith_lookup: {} } }),
    null
  );
});
