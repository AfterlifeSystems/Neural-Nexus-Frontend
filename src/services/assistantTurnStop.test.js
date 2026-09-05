import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildLocallyStoppedDoneFrame,
  isAbortError,
  resolveStopStrategy,
  terminalFrameWasStopped,
} from './assistantTurnStop.js';

test('a turn the server can identify is stopped through the stop route', () => {
  assert.equal(
    resolveStopStrategy({ requestId: 'r1', threadId: null }),
    'server'
  );
  assert.equal(
    resolveStopStrategy({ requestId: null, threadId: 't1' }),
    'server'
  );
});

test('a turn with no id yet can only be aborted', () => {
  assert.equal(
    resolveStopStrategy({ requestId: null, threadId: null }),
    'abort'
  );
  assert.equal(resolveStopStrategy({}), 'abort');
});

test('only the browser abort error counts as an abort', () => {
  const abort = new Error('aborted');
  abort.name = 'AbortError';
  assert.equal(isAbortError(abort), true);
  assert.equal(isAbortError(new TypeError('Failed to fetch')), false);
  assert.equal(isAbortError(null), false);
});

test('a locally stopped turn is finalized with what streamed', () => {
  const frame = buildLocallyStoppedDoneFrame({
    streamedText: 'The quick',
    threadId: 't1',
    requestId: 'r1',
  });
  assert.deepEqual(frame, {
    type: 'done',
    stopped: true,
    stopped_by: 'user',
    content: 'The quick',
    thread_id: 't1',
    request_id: 'r1',
  });
});

test('a suppressed internal stream is finalized empty', () => {
  const frame = buildLocallyStoppedDoneFrame({
    streamedText: '{"asserts_inaccurate_fact": true',
    suppressed: true,
  });
  assert.equal(frame.content, '');
  assert.equal(frame.thread_id, null);
  assert.equal(frame.request_id, null);
});

test('a stopped terminal frame is recognised from either flag', () => {
  assert.equal(terminalFrameWasStopped({ type: 'done', stopped: true }), true);
  assert.equal(
    terminalFrameWasStopped({
      type: 'done',
      response_metadata: { stopped: true },
    }),
    true
  );
  assert.equal(terminalFrameWasStopped({ type: 'done' }), false);
  assert.equal(terminalFrameWasStopped(null), false);
});
