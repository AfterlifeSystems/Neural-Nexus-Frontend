const BASE_EMOTIONS = new Set([
  'anger',
  'disgust',
  'fear',
  'joy',
  'sadness',
  'surprise',
  'neutral',
]);

/**
 * The emotion the voice stage should show for a reply.
 *
 * Same rule as the message-view face: follow the classified `base_emotion`.
 * Mapped GoEmotions labels (`approval` → joy) still swap the generated still.
 *
 * @param {Object|null} [sentiment] `{ emotion, base_emotion }` from the reply.
 * @returns {string} A base emotion, or `neutral`.
 */
export function voiceStageEmotion(sentiment) {
  const base = sentiment?.base_emotion;
  if (!base || base === 'neutral' || !BASE_EMOTIONS.has(base)) {
    return 'neutral';
  }
  return base;
}

/**
 * Whether the voice stage should stay on this emotion instead of returning
 * to the cyclic idle.
 *
 * A generated still is enough: idle-loop videos are optional. Snapping back
 * whenever a loop was missing is why stills-only avatars never left the
 * reference face even though the message view swapped.
 *
 * @param {Object} options
 * @param {string} [options.emotion]
 * @param {boolean} [options.isBusy] Speaking, rendering a clip, or waiting.
 * @param {boolean} [options.hasIdleLoop]
 * @param {boolean} [options.hasStill]
 * @returns {boolean} True when this emotion should remain on stage.
 */
export function voiceStageShouldKeepEmotion({
  emotion,
  isBusy = false,
  hasIdleLoop = false,
  hasStill = false,
} = {}) {
  if (!emotion || emotion === 'neutral') return true;
  if (isBusy) return true;
  if (hasIdleLoop) return true;
  if (hasStill) return true;
  return false;
}
