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
 * The emotion the voice stage may leave the neutral loop for.
 *
 * GoEmotions often labels a greeting as `approval` or `curiosity` and maps
 * that onto joy or surprise. Voice mode only swaps when the classifier named
 * a base emotion itself — an absolute classification, not a mapped relative.
 *
 * @param {Object|null} [sentiment] `{ emotion, base_emotion }` from the reply.
 * @returns {string} A base emotion, or `neutral`.
 */
export function voiceStageEmotion(sentiment) {
  const label = sentiment?.emotion;
  const base = sentiment?.base_emotion;
  if (!label || !base || label === 'neutral' || base === 'neutral') {
    return 'neutral';
  }
  if (label !== base || !BASE_EMOTIONS.has(base)) {
    return 'neutral';
  }
  return base;
}
