// src/services/mediaJobProgress.js
//
// One media-processing job, one toast, from start to finish. Shared by the
// avatar-settings upload and by chat turns in which the avatar calls its
// update_avatar_identity_with_media tool (the API announces those with a
// `media_job_started` frame on the message stream).
import { toast } from 'react-hot-toast';
import { streamMediaJobProgress } from './avatarService';

/**
 * Describe one `media_progress` frame for the toast.
 *
 * The API reports stage names; they are translated here, and an unrecognized
 * stage falls back to its own name, which is still better than a spinner that
 * says nothing.
 *
 * @param {Object} progressEvent A `media_progress` frame.
 * @param {string} description What is being processed.
 * @returns {string} A sentence for the progress toast.
 */
export const describeMediaProgress = (progressEvent, description) => {
  const stageDescriptions = {
    labeling: 'Working out what this is',
    converting_started: 'Converting',
    converting: 'Converting',
    expanding: 'Expanding the playlist',
    indexing: 'Adding to memory',
    // A reference image also becomes six emotion portraits and seven idle
    // loops; a reference recording becomes the voice audio model.
    emotion_stills: 'Generating emotion portraits',
    idle_loops: 'Animating idle loops',
    emotion_media_complete: 'Emotion media ready',
    voice_clip_collected: 'Collecting your voice',
    instant_clone_created: 'Voice audio model ready',
  };
  const stageDescription =
    stageDescriptions[progressEvent.stage] ?? progressEvent.stage ?? 'Processing';

  const documentsIndexed = progressEvent.documents_indexed ?? progressEvent.current;
  const documentsTotal = progressEvent.documents_total ?? progressEvent.total;
  const counted =
    documentsIndexed != null && documentsTotal != null
      ? ` (${documentsIndexed}/${documentsTotal})`
      : '';

  return `${stageDescription}: ${description}${counted}`;
};

// Jobs already being followed in this tab, so a stream frame that arrives twice
// (a reconnect, a resumed turn) does not raise a second toast for one job.
const followedJobIds = new Set();

/**
 * Follow a media job's progress stream and keep one toast current with it.
 *
 * @param {string} jobId The master job id from the API.
 * @param {string} description What is being processed, for the toast text.
 * @param {Object} [options]
 * @param {Function} [options.onFinished] Called with `{ ok, error }` when the job ends.
 * @returns {Promise<boolean>} Whether the job finished without an error.
 */
export const followMediaJobWithToast = async (jobId, description, { onFinished } = {}) => {
  if (!jobId || followedJobIds.has(jobId)) return false;
  followedJobIds.add(jobId);
  const label = description || 'your media';
  const progressToastId = toast.loading(`Learning from ${label}…`, {
    position: 'top-right',
  });
  let jobFailure = null;
  try {
    await streamMediaJobProgress(jobId, (progressEvent) => {
      if (progressEvent.type === 'media_progress') {
        toast.loading(describeMediaProgress(progressEvent, label), {
          id: progressToastId,
          position: 'top-right',
        });
      } else if (progressEvent.type === 'done') {
        jobFailure = progressEvent.error ?? null;
      }
    });
  } catch (streamError) {
    jobFailure = streamError?.message ?? 'The progress stream ended unexpectedly.';
  } finally {
    followedJobIds.delete(jobId);
  }
  if (jobFailure) {
    toast.error(`Learning from ${label} failed: ${jobFailure}`, {
      id: progressToastId,
      duration: 9000,
      position: 'top-right',
    });
    onFinished?.({ ok: false, error: jobFailure });
    return false;
  }
  toast.success(`Learned from ${label}`, { id: progressToastId, position: 'top-right' });
  onFinished?.({ ok: true, error: null });
  return true;
};
