// src/components/media/EmotionMediaStatus.jsx
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Loader2, RefreshCw, Sparkles } from 'lucide-react';
import useEmotionMedia from '../../hooks/useEmotionMedia';
import {
  getAvatarMediaJob,
  regenerateAvatarEmotionMedia,
} from '../../services/avatarService';
import { showRequestFailureToast } from '../requestFailureToast';

const JOB_POLL_MILLISECONDS = 4000;

/**
 * What the portrait has become: the emotion stills and idle loops derived from
 * it, with a way to (re)generate whatever is missing.
 *
 * Sits under the portrait in avatar settings. "6 emotions · 7 loops ready" is
 * the finished state; anything less lists what is missing and offers to
 * generate it. Regeneration runs as a durable job on the API and is polled
 * here until it settles, then the manifest cache is refreshed so the chat and
 * the gallery pick up the new assets without a reload.
 *
 * @param {Object} parameters
 * @param {string} parameters.assistantId The avatar.
 * @param {boolean} parameters.hasPortrait Whether a reference image exists.
 */
const EmotionMediaStatus = ({ assistantId, hasPortrait }) => {
  const { manifest, refresh } = useEmotionMedia(assistantId);
  const [jobId, setJobId] = useState(null);
  const [jobStage, setJobStage] = useState(null);
  const pollRef = useRef(null);

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
                ? `${failures.length} emotion asset${failures.length === 1 ? '' : 's'} could not be generated. Try again.`
                : job?.detail?.error || 'Emotion media generation failed.'
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

  const handleRegenerate = async (onlyMissing) => {
    try {
      const response = await regenerateAvatarEmotionMedia(assistantId, {
        onlyMissing,
      });
      setJobId(response?.job_id ?? null);
      setJobStage('Starting…');
    } catch (regenerateError) {
      showRequestFailureToast(regenerateError, {
        fallbackMessage: 'Could not start generating emotion media.',
      });
    }
  };

  if (!hasPortrait) return null;

  const emotions = manifest?.emotions ?? {};
  const stillCount = Object.values(emotions).filter((entry) => entry.still).length;
  const loopCount = Object.values(emotions).filter((entry) => entry.idleLoop).length;
  const isComplete = Boolean(manifest?.complete);
  const nothingYet = stillCount === 0 && loopCount === 0;

  return (
    <div className="w-32 text-center space-y-1.5">
      <p className="text-xs text-white/50 inline-flex items-center gap-1 justify-center">
        <Sparkles className="w-3 h-3 text-amber-300" aria-hidden="true" />
        {jobId
          ? jobStage ?? 'Generating…'
          : nothingYet
            ? 'No emotion media yet'
            : `${stillCount} emotions · ${loopCount} loops${isComplete ? ' ready' : ''}`}
      </p>
      {!jobId && !isComplete && (
        <button
          type="button"
          onClick={() => handleRegenerate(!nothingYet)}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 text-xs border border-amber-400/30 transition-colors"
        >
          <RefreshCw className="w-3 h-3" aria-hidden="true" />
          {nothingYet ? 'Generate' : 'Finish missing'}
        </button>
      )}
      {!jobId && isComplete && (
        <button
          type="button"
          onClick={() => handleRegenerate(false)}
          title="Generate the whole set again from the current portrait"
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 text-xs border border-white/10 transition-colors"
        >
          <RefreshCw className="w-3 h-3" aria-hidden="true" />
          Regenerate
        </button>
      )}
      {jobId && (
        <Loader2
          className="w-4 h-4 mx-auto animate-spin text-amber-300"
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export default EmotionMediaStatus;
