import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  voiceStageEmotion,
  voiceStageShouldKeepEmotion,
} from './voiceStageEmotion.js';

test('voice stage follows the same base emotion the message view uses', () => {
  assert.equal(voiceStageEmotion(null), 'neutral');
  assert.equal(
    voiceStageEmotion({ emotion: 'approval', base_emotion: 'joy', score: 0.58 }),
    'joy'
  );
  assert.equal(
    voiceStageEmotion({
      emotion: 'curiosity',
      base_emotion: 'surprise',
      score: 0.57,
    }),
    'surprise'
  );
  assert.equal(
    voiceStageEmotion({
      emotion: 'neutral',
      base_emotion: 'neutral',
      score: 0.95,
    }),
    'neutral'
  );
  assert.equal(voiceStageEmotion({ emotion: 'joy', score: 0.8 }), 'neutral');
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

test('a generated still is enough to keep the emotion on the voice stage', () => {
  assert.equal(
    voiceStageShouldKeepEmotion({
      emotion: 'joy',
      isBusy: false,
      hasIdleLoop: false,
      hasStill: true,
    }),
    true
  );
  assert.equal(
    voiceStageShouldKeepEmotion({
      emotion: 'joy',
      isBusy: false,
      hasIdleLoop: false,
      hasStill: false,
    }),
    false
  );
  assert.equal(
    voiceStageShouldKeepEmotion({
      emotion: 'joy',
      isBusy: true,
      hasIdleLoop: false,
      hasStill: false,
    }),
    true
  );
  assert.equal(
    voiceStageShouldKeepEmotion({
      emotion: 'joy',
      isBusy: false,
      hasIdleLoop: true,
      hasStill: false,
    }),
    true
  );
});
