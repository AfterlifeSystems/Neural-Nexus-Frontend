import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MAX_QUEUED_LIVE_UTTERANCES,
  enqueueLiveUtterance,
} from './liveUtteranceQueue.js';

test('utterances wait in order', () => {
  const first = { name: 'a.webm' };
  const second = { name: 'b.webm' };
  const queued = enqueueLiveUtterance(enqueueLiveUtterance([], first), second);
  assert.deepEqual(queued, [first, second]);
});

test('a full queue keeps the newest speech', () => {
  let queue = [];
  const files = [{ name: '1' }, { name: '2' }, { name: '3' }];
  for (const file of files) {
    queue = enqueueLiveUtterance(queue, file);
  }
  assert.equal(queue.length, MAX_QUEUED_LIVE_UTTERANCES);
  assert.deepEqual(
    queue.map((file) => file.name),
    ['2', '3']
  );
});
