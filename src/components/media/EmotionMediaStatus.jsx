// src/components/media/EmotionMediaStatus.jsx
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { AlertTriangle, Loader2, Sparkles, Wand2 } from 'lucide-react';
import useEmotionMedia from '../../hooks/useEmotionMedia';
import {
  getAvatarMediaJob,
  regenerateAvatarEmotionMedia,
} from '../../services/avatarService';
import { emotionMediaFailureMessage } from '../../services/emotionMediaFailures';
import {
  emotionMediaGenerateLabel,
  emotionMediaGenerationConfirmation,
  emotionMediaStatusView,
} from './emotionMediaStatusView';
import Modal from '../ui/Modal';

const JOB_POLL_MILLISECONDS = 4000;

/**
 * What the portrait has become: the emotion stills and idle loops derived from
 * it, and the control that builds them.
 *
 * The generate button appears as soon as a reference image exists, and is the
 * owner's way to spend on the image and video vendor deliberately: pressing it
 * opens a confirmation that says whether the run REPLACES the existing videos
 * and what the run is expected to cost, priced from the configured vendor
 * rates the server reports with the manifest. The tier
 * that may spend is a deployment setting (EMOTION_MEDIA_MINIMUM_TIER, premium
 * by default), and the manifest reports the answer per viewer, so a lower tier
 * sees the button disabled with the plan the feature needs rather than a
 * refusal after pressing.
 *
 * While a job runs this shows its stage. Afterwards, when the newest run left
 * portraits or videos missing, it shows why — for a moderation refusal, that a
 * retry repeats the charge and a different reference image is the fix; for a
 * transient miss, that re-uploading the image is how to generate them again —
 * so "the videos stopped" is never silent. When the server withheld the run
 * because it predicted the refusal from the reference image (nothing was
 * charged), the owner can still choose to generate anyway at their own cost.
 *
 * @param {Object} parameters
 * @param {string} parameters.assistantId The avatar.
 * @param {boolean} parameters.hasPortrait Whether a reference image exists.
 * @param {Function} [parameters.onReuploadImage] Opens the portrait picker;
 *   shown after a miss that is retried by replacing the reference image.
 */
/**
 * The spend-and-replace confirmation shown before a generation run starts.
 *
 * @param {Object} parameters
 * @param {Object} parameters.confirmation From emotionMediaGenerationConfirmation.
 * @param {boolean} parameters.starting Whether the run is already starting.
 * @param {Function} parameters.onCancel Dismiss without generating.
 * @param {Function} parameters.onConfirm Start the run.
 */
const GenerationConfirmation = ({
  confirmation,
  starting,
  onCancel,
  onConfirm,
}) => (
  <Modal open onClose={onCancel} title={confirmation.title} widthClassName="max-w-md">
    <div className="px-5 py-4 space-y-3">
      <p className="text-sm text-neutral-200">{confirmation.description}</p>
      <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3">
        <p className="text-sm font-semibold text-amber-200">
          {confirmation.costSummary}
        </p>
        {confirmation.costBreakdown.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-white/70 list-disc list-inside">
            {confirmation.costBreakdown.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-white/20 text-white/80 hover:bg-white/10 transition-colors text-sm"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={starting}
          className="px-4 py-2 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 border border-amber-400/30 disabled:opacity-50 transition-colors text-sm font-semibold"
        >
          {starting ? 'Starting…' : confirmation.confirmLabel}
        </button>
      </div>
    </div>
  </Modal>
);

const EmotionMediaStatus = ({ assistantId, hasPortrait, onReuploadImage }) => {
  const { manifest, refresh } = useEmotionMedia(assistantId);
  const [jobId, setJobId] = useState(null);
  const [jobStage, setJobStage] = useState(null);
  const [starting, setStarting] = useState(false);
  // The run awaiting the owner's confirmation: generation spends real money at
  // the vendor and a full rebuild deletes the videos that exist, so no run
  // starts from a single press.
  const [pendingRun, setPendingRun] = useState(null);
  const pollRef = useRef(null);

  /**
   * Start a generation run.
   *
   * @param {Object} [options]
   * @param {boolean} [options.onlyMissing] Build only the absent assets.
   * @param {boolean} [options.proceedDespiteModerationRisk] Generate anyway
   *   after the server predicted a vendor moderation refusal.
   */
  const startGeneration = async ({
    onlyMissing = true,
    proceedDespiteModerationRisk = false,
  } = {}) => {
    if (starting) return;
    setStarting(true);
    try {
      const started = await regenerateAvatarEmotionMedia(assistantId, {
        onlyMissing,
        proceedDespiteModerationRisk,
      });
      if (started?.job_id) {
        setJobStage('Generating…');
        setJobId(started.job_id);
      }
    } catch (startError) {
      toast.error(
        startError?.message || 'Emotion media generation could not start.'
      );
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    if (!jobId) return undefined;
    let cancelled = false;
    const poll = async () => {
      try {
        const job = await getAvatarMediaJob(jobId);
        if (cancelled) return;
        const stage = job?.detail?.stage;
        if (stage) {
          const { current, total } = job.detail;
          setJobStage(
            `${stage === 'emotion_stills' ? 'Portraits' : stage === 'idle_loops' ? 'Idle loops' : stage}` +
              (current != null && total != null ? ` ${current}/${total}` : '')
          );
        }
        if (job?.state === 'completed' || job?.state === 'failed') {
          setJobId(null);
          setJobStage(null);
          await refresh({ force: true });
          if (job.state === 'failed') {
            const failures = job?.detail?.failures ?? [];
            toast.error(
              failures.length
                ? emotionMediaFailureMessage(job.detail)
                : job?.detail?.error || 'Emotion media generation failed.',
              { duration: 12000 }
            );
          } else {
            toast.success('Emotion media is ready.');
          }
          return;
        }
      } catch (pollError) {
        console.debug('Media job poll failed:', pollError);
      }
      pollRef.current = setTimeout(poll, JOB_POLL_MILLISECONDS);
    };
    poll();
    return () => {
      cancelled = true;
      clearTimeout(pollRef.current);
    };
  }, [jobId, refresh]);

  if (!hasPortrait) return null;

  if (jobId) {
    return (
      <div className="w-32 text-center space-y-1.5">
        <p className="text-xs text-white/50 inline-flex items-center gap-1 justify-center">
          <Sparkles className="w-3 h-3 text-amber-300" aria-hidden="true" />
          {jobStage ?? 'Generating…'}
        </p>
        <Loader2
          className="w-4 h-4 mx-auto animate-spin text-amber-300"
          aria-hidden="true"
        />
      </div>
    );
  }

  const lastGeneration = manifest?.lastGeneration ?? null;
  // Every flag below is a boolean on purpose: `0 && <p/>` renders the number
  // zero, so a count used as a condition paints a stray "0" under the portrait.
  const view = emotionMediaStatusView(manifest);
  const { showFailure, withheld, onlyMissing } = view;
  const message = showFailure ? emotionMediaFailureMessage(lastGeneration) : '';

  // The manifest answers this per viewer: null for anyone but the creator.
  const generation = manifest?.generation ?? null;
  const generateLabel = emotionMediaGenerateLabel(view);

  return (
    <div className="w-32 text-left space-y-1.5">
      {showFailure && (
        <p
          className={`text-xs inline-flex items-start gap-1 ${
            withheld ? 'text-amber-300' : 'text-red-300'
          }`}
        >
          <AlertTriangle
            className="w-3 h-3 mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <span>{message}</span>
        </p>
      )}
      {generation && (
        <button
          type="button"
          onClick={() => setPendingRun({ onlyMissing })}
          disabled={!generation.allowed || starting}
          title={
            generation.allowed
              ? 'Generate an emotion portrait and an idle video for every emotion, from this reference image.'
              : `Generating emotion media needs the ${generation.requiredTier} plan.`
          }
          className="w-full text-xs px-2 py-1.5 rounded-md border border-amber-300/40 text-amber-200 hover:bg-amber-300/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-1"
        >
          <Wand2 className="w-3 h-3 shrink-0" aria-hidden="true" />
          {starting ? 'Starting…' : generateLabel}
        </button>
      )}
      {generation && !generation.tierAllows && (
        <p className="text-xs text-white/50">
          Emotion images and videos are generated on the{' '}
          {generation.requiredTier} plan.
        </p>
      )}
      {generation && generation.tierAllows && !generation.configured && (
        <p className="text-xs text-white/50">
          Emotion media generation is switched off for this deployment.
        </p>
      )}
      {withheld && (
        <button
          type="button"
          onClick={() =>
            setPendingRun({
              onlyMissing: true,
              proceedDespiteModerationRisk: true,
            })
          }
          disabled={starting || !generation?.allowed}
          className="w-full text-xs px-2 py-1 rounded-md border border-amber-300/40 text-amber-200 hover:bg-amber-300/10 disabled:opacity-50 transition-colors"
        >
          {starting ? 'Starting…' : 'Generate anyway (at your cost)'}
        </button>
      )}
      {pendingRun && (
        <GenerationConfirmation
          confirmation={emotionMediaGenerationConfirmation(
            { ...view, onlyMissing: pendingRun.onlyMissing },
            generation
          )}
          starting={starting}
          onCancel={() => setPendingRun(null)}
          onConfirm={async () => {
            const run = pendingRun;
            setPendingRun(null);
            await startGeneration(run);
          }}
        />
      )}
      {showFailure && !withheld && Boolean(onReuploadImage) && (
        <button
          type="button"
          onClick={onReuploadImage}
          className="w-full text-xs px-2 py-1 rounded-md border border-white/20 text-white/80 hover:bg-white/10 transition-colors"
        >
          Re-upload the image
        </button>
      )}
    </div>
  );
};

export default EmotionMediaStatus;
