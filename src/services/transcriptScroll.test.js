import assert from 'node:assert/strict';
import { test } from 'node:test';
import { transcriptScrollSignature } from './transcriptScroll.js';

const reply = {
  id: 'ai-1',
  type: 'ai',
  content: 'Hello from the avatar',
  timestamp: '2026-09-13T15:08:00.000Z',
};

test('an empty or missing transcript has no scroll signature', () => {
  assert.equal(transcriptScrollSignature(null), '');
  assert.equal(transcriptScrollSignature([]), '');
});

test('a thumb on the same words does not change the scroll signature', () => {
  const before = transcriptScrollSignature([reply]);
  const afterThumb = transcriptScrollSignature([
    { ...reply, feedback: { type: 'like', feels: null, comment: null } },
  ]);
  const afterDown = transcriptScrollSignature([
    { ...reply, feedback: { type: 'dislike', feels: null, comment: null } },
  ]);
  assert.equal(afterThumb, before);
  assert.equal(afterDown, before);
});

test('usage and sentiment on the same words do not pull the view', () => {
  const before = transcriptScrollSignature([reply]);
  const afterMetrics = transcriptScrollSignature([
    {
      ...reply,
      sentiment: { base_emotion: 'joy' },
      usage: { total_tokens: 12 },
      total_response_time_ms: 1500,
    },
  ]);
  assert.equal(afterMetrics, before);
});

test('a new turn or new words do change the scroll signature', () => {
  const one = transcriptScrollSignature([reply]);
  const two = transcriptScrollSignature([
    reply,
    { id: 'human-2', type: 'human', content: 'And you?' },
  ]);
  const streamed = transcriptScrollSignature([
    { ...reply, content: 'Hello from the avatar — more' },
  ]);
  const pending = transcriptScrollSignature([{ ...reply, isLoading: true }]);
  assert.notEqual(two, one);
  assert.notEqual(streamed, one);
  assert.notEqual(pending, one);
});
