// The seven emotions the portrait pipeline produces: the reference image as
// neutral, then one still and one idle loop for each of the six generated
// expressions. Same order as the backend BASE_EMOTIONS tuple.
export const BASE_EMOTIONS = [
  'neutral',
  'joy',
  'anger',
  'sadness',
  'fear',
  'surprise',
  'disgust',
];

export const NEUTRAL_EMOTION = 'neutral';

/**
 * @param {string} [emotion] A base emotion key.
 * @returns {string} The key with its first letter capitalised.
 */
export function titleCaseEmotion(emotion) {
  if (!emotion) return '';
  return emotion.charAt(0).toUpperCase() + emotion.slice(1);
}

/**
 * Turn an emotion-media manifest into rows for Data Uploaded.
 *
 * Each still and each idle loop is its own row so the list can filter
 * portraits from loops the same way it filters a reference image from a
 * transcript. Missing assets are omitted: this list shows what was created.
 * Every row carries `source: 'emotion'` so the list can tell generated media
 * from uploads, and a loop row carries the still it animates as `posterUrl`.
 *
 * @param {Object|null} manifest A normalized manifest from useEmotionMedia.
 * @returns {Array<Object>} Rows with `source: 'emotion'`.
 */
export function emotionMediaRows(manifest) {
  if (!manifest?.emotions) return [];
  const rows = [];
  for (const emotion of BASE_EMOTIONS) {
    const entry = manifest.emotions[emotion];
    if (!entry) continue;
    if (entry.still && entry.stillId) {
      rows.push({
        source: 'emotion',
        bucket: 'emotion_portrait',
        // The neutral still IS the reference image the owner uploaded; the
        // other six were generated from it.
        label:
          emotion === NEUTRAL_EMOTION
            ? 'Neutral portrait (reference image)'
            : `${titleCaseEmotion(emotion)} portrait`,
        emotion,
        assetKind: 'still',
        assetId: entry.stillId,
        url: entry.still,
        mimeType: entry.stillMimeType ?? null,
        createdAt: entry.stillCreatedAt ?? null,
        isEmotionPortrait: true,
        isEmotionLoop: false,
        isReferenceStill: emotion === NEUTRAL_EMOTION,
      });
    }
    if (entry.idleLoop && entry.idleLoopId) {
      rows.push({
        source: 'emotion',
        bucket: 'emotion_loop',
        label: `${titleCaseEmotion(emotion)} idle loop`,
        emotion,
        assetKind: 'idle_loop',
        assetId: entry.idleLoopId,
        url: entry.idleLoop,
        posterUrl: entry.still ?? null,
        mimeType: entry.idleLoopMimeType ?? null,
        createdAt: entry.idleLoopCreatedAt ?? null,
        durationSeconds: entry.idleLoopDurationSeconds,
        isEmotionPortrait: false,
        isEmotionLoop: true,
        isReferenceStill: false,
      });
    }
  }
  return rows;
}
