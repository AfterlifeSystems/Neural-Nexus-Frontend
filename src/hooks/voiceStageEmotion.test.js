import assert from 'node:assert/strict';
import { test } from 'node:test';
import { voiceStageEmotion } from './voiceStageEmotion.js';

test('voice stage stays on neutral unless the classifier named a base emotion', () => {
  assert.equal(voiceStageEmotion(null), 'neutral');
  assert.equal(
    voiceStageEmotion({ emotion: 'approval', base_emotion: 'joy', score: 0.58 }),
    'neutral'
  );
  assert.equal(
    voiceStageEmotion({
      emotion: 'curiosity',
      base_emotion: 'surprise',
      score: 0.57,
    }),
    'neutral'
  );
  assert.equal(
    voiceStageEmotion({
      emotion: 'neutral',
      base_emotion: 'neutral',
      score: 0.95,
    }),
    'neutral'
  );
});

test('voice stage swaps when the returned label is itself a base emotion', () => {
  assert.equal(
    voiceStageEmotion({ emotion: 'joy', base_emotion: 'joy', score: 0.82 }),
    'joy'
  );
  assert.equal(
    voiceStageEmotion({
      emotion: 'sadness',
      base_emotion: 'sadness',
      score: 0.7,
    }),
    'sadness'
  );
});
