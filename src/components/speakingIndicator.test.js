import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SPEAKING_BUBBLE_HIGHLIGHT,
  speakingBubbleProps,
  speakingGlowStyle,
  userResponseIsSpeaking,
} from './speakingIndicator.js';

test('playback of this row is a speaking user response', () => {
  assert.equal(
    userResponseIsSpeaking({ messageKey: 'm1', speakingKey: 'm1' }),
    true
  );
  assert.equal(
    userResponseIsSpeaking({ messageKey: 'm1', speakingKey: 'm2' }),
    false
  );
});

test('a pending spoken turn glows while the person is still talking', () => {
  assert.equal(
    userResponseIsSpeaking({ liveSpeaking: true, isPending: true }),
    true
  );
  assert.equal(
    userResponseIsSpeaking({ liveSpeaking: true, isPending: false }),
    false
  );
  assert.equal(
    userResponseIsSpeaking({ liveSpeaking: false, isPending: true }),
    false
  );
});

test('an identity colour recolours the speak glow and the bubble ring', () => {
  const color = { fill: '#E57373', ring: '#EF9A9A' };
  assert.deepEqual(speakingGlowStyle(color), {
    '--voice-speak-rgb': '229, 115, 115',
    '--voice-speak-bright-rgb': '239, 154, 154',
  });
  assert.equal(speakingGlowStyle(null), undefined);
  const bubble = speakingBubbleProps(color);
  assert.equal(bubble.style.borderColor, color.fill);
  assert.equal(speakingBubbleProps(null).className, SPEAKING_BUBBLE_HIGHLIGHT);
});
