import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  captionForVoiceStage,
  stagePresentationIsClip,
} from './voiceCaptionVisibility.js';

test('human lines stay visible while a reply is being staged', () => {
  const human = { id: 'h1', type: 'human', content: 'Hello' };
  assert.deepEqual(
    captionForVoiceStage(human, {
      holdNewCaptions: true,
      revealedIds: new Set(),
    }),
    human
  );
});

test('a pending avatar line stays as typing dots', () => {
  const pending = { id: 'a1', type: 'ai', content: '', isLoading: true };
  assert.equal(
    captionForVoiceStage(pending, {
      holdNewCaptions: true,
      revealedIds: new Set(),
    }).isLoading,
    true
  );
});

test('a finished avatar line stays hidden until the talking face is revealed', () => {
  const reply = { id: 'a2', type: 'ai', content: 'Nice to meet you' };
  const held = captionForVoiceStage(reply, {
    holdNewCaptions: true,
    revealedIds: new Set(),
  });
  assert.equal(held.isLoading, true);
  assert.equal(held.content, '');
  assert.notEqual(held.content, reply.content);
});

test('the finished line appears once the clip (or loop) has been revealed', () => {
  const reply = { id: 'a2', type: 'ai', content: 'Nice to meet you' };
  assert.deepEqual(
    captionForVoiceStage(reply, {
      holdNewCaptions: true,
      revealedIds: new Set(['a2']),
    }),
    reply
  );
});

test('only the talking clip releases a wait, not the emotion loop', () => {
  const clipUrl = 'https://cdn.example/reply.mp4';
  assert.equal(
    stagePresentationIsClip({ src: clipUrl, poster: '/still.png' }, clipUrl),
    true
  );
  assert.equal(
    stagePresentationIsClip({ src: '/idle.mp4', poster: '/still.png' }, clipUrl),
    false
  );
  assert.equal(stagePresentationIsClip(undefined, clipUrl), false);
});
