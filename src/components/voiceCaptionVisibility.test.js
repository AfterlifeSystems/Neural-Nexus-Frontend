import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  captionForVoiceStage,
  shouldShowVoiceStageText,
  stagePresentationIsClip,
  voiceExchangeHasGeneratingText,
  voiceMessageIsGenerating,
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

test('a notice card is not held behind typing dots', () => {
  const notice = {
    id: 'n1',
    type: 'ai',
    content: 'I noticed your Thunderbird inbox is open.',
    ambient: { decision: 'notify', summary: 'Thunderbird shows an inbox.' },
  };
  assert.deepEqual(
    captionForVoiceStage(notice, {
      holdNewCaptions: true,
      revealedIds: new Set(),
    }),
    notice
  );
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

test('Stop belongs on the avatar line that is still generating', () => {
  assert.equal(
    voiceMessageIsGenerating({ id: 'a1', type: 'ai', isLoading: true }),
    true
  );
  assert.equal(
    voiceMessageIsGenerating({
      id: 'streaming-1',
      type: 'ai',
      content: 'Hi',
      streamingText: true,
    }),
    true
  );
  assert.equal(
    voiceMessageIsGenerating({ id: 'a2', type: 'ai', content: 'Done' }),
    false
  );
  assert.equal(
    voiceMessageIsGenerating({ id: 'h1', type: 'human', isLoading: true }),
    false
  );
});

test('Stop leaves a finished streaming row once the words are done', () => {
  const finished = {
    id: 'streaming-1',
    type: 'ai',
    content: 'Hi',
    streamingText: false,
  };
  assert.equal(voiceMessageIsGenerating(finished), false);
  assert.equal(
    voiceMessageIsGenerating({ ...finished, isLoading: true }),
    false
  );
  assert.equal(
    voiceMessageIsGenerating({
      id: 'streaming-1',
      type: 'ai',
      content: 'Hi',
    }),
    false
  );
  assert.equal(voiceMessageIsGenerating(finished, { turnActive: false }), false);
});

test('a later turn does not put Stop back on earlier streaming rows', () => {
  assert.equal(
    voiceExchangeHasGeneratingText([
      { id: 'streaming-1', type: 'ai', content: 'Earlier', streamingText: false },
      { id: 'h2', type: 'human', content: 'Again' },
      {
        id: 'streaming-2',
        type: 'ai',
        content: 'Now',
        streamingText: true,
      },
    ]),
    true
  );
  assert.equal(
    voiceMessageIsGenerating({
      id: 'streaming-1',
      type: 'ai',
      content: 'Earlier',
      streamingText: false,
    }),
    false
  );
  assert.equal(
    voiceExchangeHasGeneratingText([
      { id: 'streaming-1', type: 'ai', content: 'Done', streamingText: false },
    ]),
    false
  );
});

test('a folded bar with captions off hides text unless the avatar is muted', () => {
  assert.equal(
    shouldShowVoiceStageText({
      messageBarCollapsed: true,
      captionsShown: false,
      avatarMuted: false,
    }),
    false
  );
  assert.equal(
    shouldShowVoiceStageText({
      messageBarCollapsed: true,
      captionsShown: false,
      avatarMuted: true,
    }),
    true
  );
});

test('an open bar still shows the caption-hidden line', () => {
  assert.equal(
    shouldShowVoiceStageText({
      messageBarCollapsed: false,
      captionsShown: false,
      avatarMuted: false,
    }),
    true
  );
});

test('captions on means this overlay stays off', () => {
  assert.equal(
    shouldShowVoiceStageText({
      messageBarCollapsed: true,
      captionsShown: true,
      avatarMuted: true,
    }),
    false
  );
});

test('a blocked play keeps the line up even when the bar is folded', () => {
  assert.equal(
    shouldShowVoiceStageText({
      messageBarCollapsed: true,
      captionsShown: false,
      avatarMuted: false,
      hasVoiceModel: true,
      playbackBlocked: true,
    }),
    true
  );
});

test('no voice model keeps the line up even when the bar is folded', () => {
  assert.equal(
    shouldShowVoiceStageText({
      messageBarCollapsed: true,
      captionsShown: false,
      avatarMuted: false,
      hasVoiceModel: false,
    }),
    true
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

test('a connect card is shown while new captions are held', () => {
  const card = {
    id: 'pause-1',
    type: 'ai',
    content: '',
    connections: [{ provider: 'gmail', status: 'pending_login', pending: true }],
  };
  const shown = captionForVoiceStage(card, {
    holdNewCaptions: true,
    revealedIds: new Set(),
  });
  assert.equal(shown, card);
});
