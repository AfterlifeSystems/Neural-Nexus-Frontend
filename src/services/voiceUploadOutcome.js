/**
 * Why a Voice-section upload added nothing to the voice, or `null` when speech
 * was added (or the finished batch reported no voice figures at all).
 *
 * A batch that finished without error can still have added zero seconds: every
 * item failed, or the recordings held no speech of the avatar. For the Voice
 * section that is a failure, because the point of the upload was the voice.
 *
 * @param {Object|null|undefined} batchResult The master job's final result.
 * @returns {string|null}
 */
export const describeVoiceUploadFailure = (batchResult) => {
  if (!batchResult || typeof batchResult.voice_seconds_collected !== 'number') {
    return null;
  }
  if (batchResult.voice_seconds_collected > 0) return null;
  const itemErrors = (batchResult.items ?? [])
    .map((item) => item?.error)
    .filter(Boolean);
  if (itemErrors.length > 0) return itemErrors.join('; ');
  return 'No speech was added to the voice from this upload.';
};
