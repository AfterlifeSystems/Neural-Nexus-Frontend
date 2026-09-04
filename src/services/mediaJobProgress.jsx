// src/services/mediaJobProgress.jsx
//
// One media-processing job, one toast, from start to finish. Used by chat
// turns in which the avatar calls its update_avatar_identity_with_media
// tool (the API announces those with a `media_job_started` frame on the
// message stream). Avatar-settings uploads follow the job in the Upload
// section instead.
import { toast } from 'react-hot-toast';
import { streamMediaJobProgress } from './avatarService';
import MediaProcessToast from '../components/media/MediaProcessToast';
import {
  applyMediaProgress,
  finalizePipelineSteps,
  stepsForMediaKind,
} from './mediaProcessSteps.js';

const STAGE_LABELS = {
  labeling: 'Working out what this is',
  converting_started: 'Converting',
  converting: 'Converting',
  expanding: 'Expanding the playlist',
  indexing: 'Adding to memory',
  emotion_stills: 'Creating avatar portraits',
  idle_loops: 'Creating avatar emotion videos',
  emotion_media_complete: 'Emotion media ready',
  voice_clip_collected: 'Collecting your voice',
  instant_clone_created: 'Voice audio model ready',
};

/**
 * Describe one `media_progress` frame as a single sentence.
 *
 * Kept for callers that still need a line of text. Chat-started jobs use
 * {@link startMediaProcessToast} so every pipeline step stays on one card
 * at 0/N until it finishes.
 *
 * @param {Object} progressEvent A `media_progress` frame.
 * @param {string} description What is being processed.
 * @returns {string} A sentence for a progress toast.
 */
export const describeMediaProgress = (progressEvent, description) => {
  const stageDescription =
    STAGE_LABELS[progressEvent.stage] ?? progressEvent.stage ?? 'Processing';
  const documentsIndexed = progressEvent.documents_indexed ?? progressEvent.current;
  const documentsTotal = progressEvent.documents_total ?? progressEvent.total;
  const counted =
    documentsIndexed != null && documentsTotal != null
      ? ` (${documentsIndexed}/${documentsTotal})`
      : '';
  return `${stageDescription}: ${description}${counted}`;
};

export { stepsForMediaKind };

/**
 * Open one process toast and keep it current until the whole job finishes.
 *
 * @param {Object} options
 * @param {string} options.title Heading for the card.
 * @param {'portrait'|'voice'|'document'} [options.kind]
 * @returns {{
 *   id: string,
 *   applyProgress: Function,
 *   succeed: Function,
 *   fail: Function,
 *   dismiss: Function,
 * }}
 */
export const startMediaProcessToast = ({ title, kind = 'document' }) => {
  const toastId = `media-process-${kind}-${Date.now()}`;
  const steps = stepsForMediaKind(kind);
  let status = 'running';
  let error = null;

  const render = (duration) => {
    toast.custom(
      () => (
        <MediaProcessToast
          title={title}
          steps={steps.map((step) => ({ ...step }))}
          status={status}
          error={error}
        />
      ),
      {
        id: toastId,
        duration,
        position: 'top-right',
      }
    );
  };

  render(Infinity);

  return {
    id: toastId,
    applyProgress(progressEvent) {
      if (!progressEvent || status !== 'running') return;
      applyMediaProgress(steps, progressEvent);
      render(Infinity);
    },
    succeed() {
      const unfinished = finalizePipelineSteps(steps, kind);
      status = 'success';
      // Unseen portrait/loop rows stay at 0/N (generation skipped). Keep the
      // card up a little longer so those 0/N lines are visible, then dismiss.
      render(unfinished ? 12000 : 8000);
    },
    fail(message) {
      status = 'error';
      error = message;
      const active = steps.find((step) => step.state === 'active');
      if (active) active.state = 'error';
      render(9000);
    },
    dismiss() {
      toast.dismiss(toastId);
    },
  };
};

// Jobs already being followed in this tab, so a stream frame that arrives twice
// (a reconnect, a resumed turn) does not raise a second toast for one job.
const followedJobIds = new Set();

const kindFromDescription = (description) => {
  const label = String(description ?? '').toLowerCase();
  if (label.includes('portrait') || label.includes('reference image')) {
    return 'portrait';
  }
  if (label.includes('voice') || label.includes('audio')) {
    return 'voice';
  }
  return 'document';
};

/**
 * Follow a media job's progress stream and keep one toast current with it.
 *
 * @param {string} jobId The master job id from the API.
 * @param {string} description What is being processed, for the toast text.
 * @param {Object} [options]
 * @param {Function} [options.onFinished] Called with `{ ok, error }` when the job ends.
 * @returns {Promise<boolean>} Whether the job finished without an error.
 */
export const followMediaJobWithToast = async (
  jobId,
  description,
  { onFinished } = {}
) => {
  if (!jobId || followedJobIds.has(jobId)) return false;
  followedJobIds.add(jobId);
  const label = description || 'your media';
  const kind = kindFromDescription(label);
  const processToast = startMediaProcessToast({
    title:
      kind === 'portrait' ? 'Creating the avatar portrait' : `Updating ${label}`,
    kind,
  });
  processToast.applyProgress({ stage: 'upload', current: 1, total: 1 });
  let jobFailure = null;
  try {
    await streamMediaJobProgress(jobId, (progressEvent) => {
      if (progressEvent.type === 'media_progress') {
        processToast.applyProgress(progressEvent);
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
    processToast.fail(jobFailure);
    onFinished?.({ ok: false, error: jobFailure });
    return false;
  }
  processToast.succeed();
  onFinished?.({ ok: true, error: null });
  return true;
};
