import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  INITIAL_EVAN_STREAM,
  asAvatarList,
  buildEvanMessageRequest,
  buildEvanResumeRequest,
  buildEvanUserMessage,
  describeEvanAmbientStatus,
  isEvanObservationActive,
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

test('observations run only while the help window is open and a share is live', () => {
  assert.equal(
    isEvanObservationActive({ windowOpen: true, hasScreenShare: true }),
    true
  );
  assert.equal(
    isEvanObservationActive({ windowOpen: true, hasWebcam: true }),
    true
  );
  assert.equal(
    isEvanObservationActive({ windowOpen: false, hasScreenShare: true }),
    false
  );
  assert.equal(
    isEvanObservationActive({ windowOpen: false, hasWebcam: true }),
    false
  );
  assert.equal(
    isEvanObservationActive({
      windowOpen: true,
      hasScreenShare: false,
      hasWebcam: false,
    }),
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
  assert.match(built.apiText, /sharing the screen/);
  assert.match(built.apiText, /What is this button\?/);
});

test('a live share is named as background watching, never as an attachment', () => {
  const both = buildEvanUserMessage({
    text: 'Any ideas?',
    screenShared: true,
    webcamShared: true,
  });
  assert.match(both.apiText, /screen and the webcam/);
  assert.match(both.apiText, /in the background/);
  assert.doesNotMatch(both.apiText, /attached/);

  const webcamOnly = buildEvanUserMessage({ text: 'Hi', webcamShared: true });
  assert.match(webcamOnly.apiText, /sharing the webcam/);
});

test('an empty turn with a live share still asks Evan what he can see', () => {
  assert.match(buildEvanUserMessage({ screenShared: true }).displayText, /see/);
  assert.match(buildEvanUserMessage({ webcamShared: true }).displayText, /see/);
  assert.equal(buildEvanUserMessage({}).displayText, '');
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

test('the first frame names the run so a look can be stopped for the person', () => {
  const state = reduceEvanStreamEvent(INITIAL_EVAN_STREAM, {
    type: 'turn_started',
    request_id: 'request-7',
    thread_id: 'thread-7',
  });
  assert.equal(state.requestId, 'request-7');
  assert.equal(state.threadId, 'thread-7');
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

// --- What the overlay is sharing, reported so the avatar can look ----------
//
// The overlay owns its own webcam and screen streams rather than going through
// MediaShareContext, so nothing else can report them. Without this the help
// avatar was told nothing was shared and said so — while the person watched
// their own screen being captured for it.

test('a turn reports what the overlay has live', () => {
  const request = buildEvanMessageRequest('evan-1', {
    message: 'what is on my screen?',
    liveShares: ['screen'],
  });
  assert.equal(request.formData.get('live_shares'), '["screen"]');
});

test('a turn with nothing shared says nothing rather than lying', () => {
  const request = buildEvanMessageRequest('evan-1', { message: 'hello' });
  assert.equal(request.formData.get('live_shares'), null);
});

test('a look resume carries the frames, their sources, and the share report', () => {
  // All three matter: the frames are the answer, the sources say which view
  // each one is, and the share report is what stops the rebuilt look_now
  // deciding there was nothing to look at and discarding them unread.
  const frame = new File(['x'], 'screen.jpg', { type: 'image/jpeg' });
  const request = buildEvanResumeRequest('evan-1', {
    threadId: 'thread-9',
    decision: 'looked',
    liveShares: ['screen'],
    sources: ['screen'],
    files: [frame],
  });
  assert.equal(request.formData.get('decision'), 'looked');
  assert.equal(request.formData.get('live_shares'), '["screen"]');
  assert.equal(request.formData.get('sources'), '["screen"]');
  assert.equal(request.formData.getAll('files').length, 1);
});

test('an approval resume is unchanged by any of that', () => {
  const request = buildEvanResumeRequest('evan-1', {
    threadId: 'thread-9',
    decision: 'apply',
  });
  assert.equal(request.formData.get('live_shares'), null);
  assert.equal(request.formData.get('sources'), null);
  assert.equal(request.formData.getAll('files').length, 0);
});

test('a turn reports a capture the main app owns, not only the overlay own', () => {
  // The browser shows one "sharing your screen" indicator for two independent
  // captures, so the avatar saying it cannot see while that indicator is on is
  // the bug. The caller unions both owners; the builder just has to carry it.
  const request = buildEvanMessageRequest('evan-1', {
    message: 'what is on my screen?',
    liveShares: ['webcam', 'screen'],
  });
  assert.equal(request.formData.get('live_shares'), '["webcam","screen"]');
});

test('a screen being peeked at in the main app is reported as peekable', () => {
  const request = buildEvanMessageRequest('evan-1', {
    message: 'what is on my screen?',
    peekableShares: ['screen'],
  });
  assert.equal(request.formData.get('peekable_shares'), '["screen"]');
  assert.equal(request.formData.get('live_shares'), null);
});

test('a look resume carries the peekable report as well', () => {
  const request = buildEvanResumeRequest('evan-1', {
    threadId: 'thread-9',
    decision: 'looked',
    peekableShares: ['screen'],
  });
  assert.equal(request.formData.get('peekable_shares'), '["screen"]');
});
