// src/components/media/EmotionMediaStatus.jsx
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Loader2, Sparkles } from 'lucide-react';
import useEmotionMedia from '../../hooks/useEmotionMedia';
import { getAvatarMediaJob } from '../../services/avatarService';

const JOB_POLL_MILLISECONDS = 4000;

/**
 * What the portrait has become: the emotion stills and idle loops derived from
 * it. Status only — generation is not started from under the reference image.
 *
 * @param {Object} parameters
 * @param {string} parameters.assistantId The avatar.
 * @param {boolean} parameters.hasPortrait Whether a reference image exists.
 */
const EmotionMediaStatus = ({ assistantId, hasPortrait }) => {
  const { refresh } = useEmotionMedia(assistantId);
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

  if (!hasPortrait || !jobId) return null;

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
};

export default EmotionMediaStatus;
