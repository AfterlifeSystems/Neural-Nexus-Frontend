import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  INITIAL_EVAN_STREAM,
  asAvatarList,
  buildEvanMessageRequest,
  buildEvanResumeRequest,
  buildEvanUserMessage,
  createTurnGate,
  describeEvanAmbientStatus,
  isEvanScreenObservationActive,
  pickEvanAvatar,
  reduceEvanStreamEvent,
  shouldOfferEvanAssist,
} from './evanAssistSession.js';

test('a failed look does not read as if the person could not send', () => {
  assert.equal(
    describeEvanAmbientStatus(
      { inFlight: false, lastError: 'nope', consecutiveFailures: 1 },
      0
    ),
    'Look failed'
  );
  assert.match(
    describeEvanAmbientStatus(
      { inFlight: false, lastError: 'nope', consecutiveFailures: 1 },
      15_000
    ),
    /Look failed/
  );
  assert.equal(
    describeEvanAmbientStatus({ inFlight: true, lastError: null, consecutiveFailures: 0 }, 0),
    'Looking…'
  );
});

test('the turn gate runs one task at a time', async () => {
  const gate = createTurnGate();
  const order = [];
  const first = gate.run(async () => {
    order.push('start-a');
    await new Promise((resolve) => setTimeout(resolve, 20));
    order.push('end-a');
    return 'a';
  });
  assert.equal(gate.busy, true);
  const second = gate.run(async () => {
    order.push('start-b');
    order.push('end-b');
    return 'b';
  });
  assert.deepEqual(await Promise.all([first, second]), ['a', 'b']);
  assert.deepEqual(order, ['start-a', 'end-a', 'start-b', 'end-b']);
  assert.equal(gate.busy, false);
});

test('screen observations run only while the help window is open and a share is live', () => {
  assert.equal(
    isEvanScreenObservationActive({ windowOpen: true, hasScreenShare: true }),
    true
  );
  assert.equal(
    isEvanScreenObservationActive({ windowOpen: false, hasScreenShare: true }),
    false
  );
  assert.equal(
    isEvanScreenObservationActive({ windowOpen: true, hasScreenShare: false }),
    false
  );
});

test('pickEvanAvatar prefers a configured id, then the name Evan, then a fallback id', () => {
  const listing = [
    { assistant_id: 'demo-1', name: 'Demo' },
    { assistant_id: 'evan-9', name: 'Evan' },
  ];
  assert.equal(
    pickEvanAvatar(listing, { configuredId: 'demo-1' }).assistant_id,
    'demo-1'
  );
  assert.equal(pickEvanAvatar(listing, { displayName: 'Evan' }).assistant_id, 'evan-9');
  assert.equal(
    pickEvanAvatar([{ assistant_id: 'other', name: 'Other' }], {
      fallbackId: 'fallback-1',
    }).assistant_id,
    'fallback-1'
  );
});

test('asAvatarList accepts a bare array or an {avatars} wrapper', () => {
  assert.deepEqual(asAvatarList([{ assistant_id: 'a' }]), [{ assistant_id: 'a' }]);
  assert.deepEqual(asAvatarList({ avatars: [{ assistant_id: 'b' }] }), [
    { assistant_id: 'b' },
  ]);
  assert.deepEqual(asAvatarList(null), []);
});

test('the help control stays off in the demo iframe and on Evan public share page', () => {
  assert.equal(shouldOfferEvanAssist({ inIframe: true }), false);
  assert.equal(
    shouldOfferEvanAssist({
      pathname: '/share/evan-1',
      currentAssistantId: 'evan-1',
      evanAssistantId: 'evan-1',
    }),
    false
  );
  assert.equal(
    shouldOfferEvanAssist({
      pathname: '/avatars',
      currentAssistantId: 'other',
      evanAssistantId: 'evan-1',
    }),
    true
  );
});

test('a spoken line keeps its words in the bubble and names the place for Evan', () => {
  const built = buildEvanUserMessage({
    text: 'What is this button?',
    locationLabel: 'the avatar gallery',
    screenShared: true,
  });
  assert.equal(built.displayText, 'What is this button?');
  assert.match(built.apiText, /avatar gallery/);
  assert.match(built.apiText, /screen share/);
  assert.match(built.apiText, /What is this button\?/);
});

test('an empty turn with a live share still asks Evan about the screen', () => {
  const built = buildEvanUserMessage({ screenShared: true });
  assert.match(built.displayText, /see/);
});

test('the message request streams and omits a missing thread id', () => {
  const request = buildEvanMessageRequest('evan-1', {
    message: 'Hello',
    files: [new File(['x'], 'screen.jpg', { type: 'image/jpeg' })],
    userTimezone: 'America/New_York',
  });
  assert.equal(request.path, '/message/evan-1');
  assert.equal(request.formData.get('stream'), 'true');
  assert.equal(request.formData.get('message'), 'Hello');
  assert.equal(request.formData.get('thread_id'), null);
  assert.equal(request.formData.get('user_timezone'), 'America/New_York');
});

test('a resume request names the paused thread and the decision', () => {
  const request = buildEvanResumeRequest('evan-1', {
    threadId: 'thread-9',
    decision: 'apply',
  });
  assert.equal(request.path, '/message/evan-1/resume');
  assert.equal(request.formData.get('thread_id'), 'thread-9');
  assert.equal(request.formData.get('decision'), 'apply');
});

test('stream frames grow the reply and record a pause', () => {
  let state = reduceEvanStreamEvent(INITIAL_EVAN_STREAM, {
    type: 'assistant_token',
    text: 'Hi',
  });
  state = reduceEvanStreamEvent(state, { type: 'assistant_token', text: ' there' });
  assert.equal(state.streamedText, 'Hi there');
  assert.equal(state.activity, 'Responding');
  state = reduceEvanStreamEvent(state, {
    type: 'interrupt',
    thread_id: 't1',
    interrupt: { kind: 'mcp_connect_consent' },
  });
  assert.equal(state.threadId, 't1');
  assert.equal(state.interrupt.kind, 'mcp_connect_consent');
  assert.equal(state.activity, null);
});

test('a done frame adopts the server text and clears a leftover interrupt', () => {
  const state = reduceEvanStreamEvent(
    { ...INITIAL_EVAN_STREAM, interrupt: { kind: 'x' }, streamedText: 'old' },
    { type: 'done', content: 'final', thread_id: 't2' }
  );
  assert.equal(state.streamedText, 'final');
  assert.equal(state.threadId, 't2');
  assert.equal(state.interrupt, null);
});
