// src/components/voice/VoicePanel.jsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Dropzone from 'react-dropzone';
import { toast } from 'react-hot-toast';
import {
  AudioLines,
  Check,
  Link,
  Loader2,
  Mic,
  RefreshCw,
  ShieldCheck,
  Square,
  Upload,
} from 'lucide-react';
import ProgressBar from '../ui/ProgressBar';
import UploadProcessPanel from '../media/UploadProcessPanel';
import {
  addAvatarVoiceSample,
  getAvatarVoice,
  getAvatarVoiceVerification,
  retryAvatarProfessionalVoice,
  streamMediaJobProgress,
  submitAvatarVoiceVerification,
  uploadAvatarIdentityMedia,
} from '../../services/avatarService';
import { singleReferenceAudioUrl } from '../../services/referenceAudioUrl';
import {
  canCaptureMicrophone,
  recordOneTurn,
} from '../../services/voiceSession';
import { showRequestFailureToast } from '../requestFailureToast';

// About two minutes read at a conversational pace, with the calibration
// sentence the diarizer's reference clip is compared against placed first.
const RECORDING_SCRIPT = [
  'The quick fox jumped over the brown lazy dog.',
  'Hello, this is me, and this is how I sound when I talk with someone I know well.',
  'I am recording a couple of minutes so my avatar can speak in my own voice, with my pauses and my rhythm.',
  'On an ordinary morning I make something warm to drink, look out of the window for a minute, and think about what the day needs from me.',
  'When a friend asks how I am doing, I usually tell the truth: some days are easy, some are not, and most are somewhere in between.',
  'Numbers, for range: one, two, three, four, five, six, seven, eight, nine, ten, eleven, twelve, twenty, fifty, one hundred, one thousand.',
  'Days and months: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday; January, April, July, October, December.',
  'Here is a question. Do you remember the last time we sat outside and talked until it got dark? I do.',
  'Here is something said with feeling: I am really glad you called. It has been too long, and I have missed this.',
  'And something matter-of-fact: the meeting moved to three o’clock, the report is in the shared folder, and I will send the summary tonight.',
  'A few names and places: Chicago, Berlin, Tokyo, the river, the old bridge, the corner shop, my grandmother’s kitchen.',
  'To finish: thank you for listening. Talk to you soon.',
];

const describeSeconds = (seconds) => {
  const whole = Math.round(seconds ?? 0);
  if (whole < 90) return `${whole}s`;
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
};

const STATE_LABELS = {
  not_started: 'Not started',
  collecting: 'Collecting',
  awaiting_verification: 'Ready to verify',
  training: 'Training (3–6 hours)',
  fine_tuned: 'Ready',
  failed: 'Failed',
  plan_required: 'Needs ElevenLabs Creator plan',
};

/**
 * The avatar's voice: record it, watch the corpus fill, verify the professional voice model.
 *
 * Every avatar gets a voice audio model (the instant clone) once a minute of
 * its speech is collected (rebuilt at two minutes). The personal avatar keeps
 * collecting — from this recorder and from every audio or video uploaded of
 * the owner — toward the thirty minutes a professional voice model needs; when that
 * is reached the panel shows the CAPTCHA the owner reads aloud, and training
 * starts on submit.
 *
 * Audio and video dropped here (and video URLs) are identity media as well as
 * the voice reference: the identity-media job transcribes and diarizes them,
 * indexes the avatar's speech into its identity, and feeds the clone corpus.
 * Only microphone takes of the script bypass identity, via the corpus endpoint.
 *
 * @param {Object} parameters
 * @param {string} parameters.assistantId The avatar.
 * @param {boolean} parameters.isPersonalAvatar Whether the professional path applies.
 * @param {string} [parameters.avatarName] For labels.
 * @param {Function} [parameters.startUpload] Identity-media job starter from
 *   Settings. When set, a video URL uses the same checklist as other uploads.
 * @param {Array<Object>} [parameters.voiceJobs] Voice-kind jobs to show here.
 * @param {Function} [parameters.onCancelJob]
 * @param {Function} [parameters.onDismissJob]
 * @param {number} [parameters.refreshToken] Bumped by the parent when something
 *   outside this panel changed the voice (a deleted upload, a new reference).
 */
const VoicePanel = ({
  assistantId,
  isPersonalAvatar,
  avatarName,
  startUpload,
  voiceJobs = [],
  onCancelJob,
  onDismissJob,
  refreshToken = 0,
}) => {
  const [status, setStatus] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [referenceUrl, setReferenceUrl] = useState('');
  const [scriptIndex, setScriptIndex] = useState(0);
  const [captcha, setCaptcha] = useState(null);
  const [isRecordingCaptcha, setIsRecordingCaptcha] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const recordingRef = useRef(null);
  const recordingStartedAtRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      setStatus(await getAvatarVoice(assistantId));
    } catch (loadError) {
      console.debug('Voice status unavailable:', loadError);
    }
  }, [assistantId]);

  useEffect(() => {
    refresh();
  }, [refresh, refreshToken]);

  // A finished voice job changed the corpus (and maybe stored the reference):
  // re-read the status once per job that reaches success.
  const finishedJobIdsRef = useRef(new Set());
  useEffect(() => {
    const newlyFinished = voiceJobs.filter(
      (job) =>
        job.status === 'success' && !finishedJobIdsRef.current.has(job.localId)
    );
    if (newlyFinished.length === 0) return;
    for (const job of newlyFinished) finishedJobIdsRef.current.add(job.localId);
    refresh();
  }, [voiceJobs, refresh]);

  useEffect(() => () => recordingRef.current?.cancel(), []);

  /**
   * Say what an upload achieved. "Stored as the voice audio model" used to be
   * the message even when the clone did not exist yet, so a three-second file
   * read as a finished voice. Now the toast reports the seconds collected and
   * how many remain before the avatar can speak.
   *
   * @param {string} label What was uploaded, for the sentence.
   * @returns {Promise<void>}
   */
  const announceVoiceProgress = async (label) => {
    let latest = null;
    try {
      latest = await getAvatarVoice(assistantId);
      setStatus(latest);
    } catch (loadError) {
      console.debug('Voice status unavailable:', loadError);
    }
    const collectedNow = Math.round(latest?.collected_seconds ?? 0);
    const minimum = latest?.instant_minimum_seconds ?? 60;
    const becameReference =
      Boolean(label) && latest?.reference_audio_document === label;
    const referenceNote = becameReference
      ? ' and is now the reference audio'
      : '';
    if (latest?.instant_voice_id) {
      toast.success(
        `${label} added${referenceNote}. Voice model ready — ${avatarName ?? 'the avatar'} can speak.`
      );
      return;
    }
    const remaining = Math.max(0, Math.ceil(minimum - collectedNow));
    toast.success(
      `${label} added${referenceNote}. ${collectedNow}s of speech collected; ` +
        `${remaining}s more needed before ${avatarName ?? 'the avatar'} can speak.`,
      { duration: 8000 }
    );
  };

  const submitRecording = async (file, description) => {
    setIsUploading(true);
    try {
      const response = await addAvatarVoiceSample(assistantId, file);
      setStatus(response);
      const added = Math.round(response?.added_seconds ?? 0);
      toast.success(
        added > 0
          ? `${added}s of ${avatarName ?? 'the avatar'} speaking added.`
          : `${description} added.`
      );
      if (response?.instant_voice_id && !status?.instant_voice_id) {
        toast.success('Voice model ready — the avatar can speak now.');
      }
      // The first take also becomes the diarizer's reference clip; the corpus
      // endpoint stores that itself. Later takes only grow the corpus.
    } catch (uploadError) {
      showRequestFailureToast(uploadError, {
        fallbackMessage: `${description} could not be added.`,
      });
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Uploaded audio or video files of the avatar speaking, for every avatar.
   *
   * The files are identity media: one job transcribes and diarizes each
   * recording, indexes what the avatar said, and adds the avatar's speech to
   * the voice model. The server stores the first speech upload as the
   * reference clip on its own, so no reference flag is sent, and later
   * uploads never replace the reference. Only microphone takes of the script
   * skip that job (submitRecording), since a read script carries no identity.
   *
   * @param {File[]} files The recordings.
   */
  const submitVoiceMediaUpload = async (files) => {
    if (!files?.length) return;
    setIsUploading(true);
    const label = files.length === 1 ? files[0].name : `${files.length} files`;
    try {
      if (startUpload) {
        const stored = await startUpload({ files, kind: 'voice' });
        if (!stored) return;
      } else {
        const uploadResponse = await uploadAvatarIdentityMedia({
          assistantId,
          files,
        });
        const jobId = uploadResponse?.job_id;
        if (jobId) {
          await streamMediaJobProgress(jobId, () => {});
        }
      }
      await announceVoiceProgress(files.length === 1 ? files[0].name : label);
    } catch (uploadError) {
      showRequestFailureToast(uploadError, {
        fallbackMessage: `${label} could not be added.`,
      });
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * A YouTube or direct video/audio URL of the avatar speaking. The same job
   * as a file: identity, voice model, and the reference clip when none exists.
   *
   * @param {string} text Pasted or typed address(es).
   */
  const submitVoiceMediaUrl = async (text) => {
    const parsed = singleReferenceAudioUrl(text);
    if (parsed.error) {
      toast.error(parsed.error);
      return;
    }
    const { url } = parsed;
    setIsUploading(true);
    setReferenceUrl('');
    try {
      if (startUpload) {
        const stored = await startUpload({ urls: [url], kind: 'voice' });
        if (!stored) return;
      } else {
        const uploadResponse = await uploadAvatarIdentityMedia({
          assistantId,
          urls: [url],
        });
        const jobId = uploadResponse?.job_id;
        if (jobId) {
          await streamMediaJobProgress(jobId, () => {});
        }
      }
      await announceVoiceProgress(url);
    } catch (uploadError) {
      showRequestFailureToast(uploadError, {
        fallbackMessage: 'That URL could not be added to the voice.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const startRecording = async () => {
    if (!canCaptureMicrophone()) {
      toast.error(
        'This browser cannot record audio here (a secure connection is required).'
      );
      return;
    }
    try {
      recordingRef.current = await recordOneTurn();
      recordingStartedAtRef.current = Date.now();
      setIsRecording(true);
    } catch (microphoneError) {
      toast.error(
        microphoneError?.name === 'NotAllowedError'
          ? 'Microphone access was refused. Allow it in your browser to record.'
          : 'Could not start recording.'
      );
    }
  };

  const stopRecording = async () => {
    const recording = recordingRef.current;
    if (!recording) return;
    recordingRef.current = null;
    setIsRecording(false);
    const file = await recording.stop();
    const elapsedSeconds =
      (Date.now() - (recordingStartedAtRef.current ?? Date.now())) / 1000;
    if (elapsedSeconds < 2) {
      toast('Too short — read the whole line, then stop.', { icon: '🎙' });
      return;
    }
    setScriptIndex((index) => Math.min(index + 1, RECORDING_SCRIPT.length - 1));
    await submitRecording(file, 'Recording');
  };

  const handleDrop = async (files, fileRejections, dropEvent) => {
    const droppedUrlText =
      dropEvent?.dataTransfer?.getData('text/uri-list') ||
      dropEvent?.dataTransfer?.getData('text/plain') ||
      '';
    if (fileRejections?.length) {
      toast.error(
        'Only audio or video files, or a YouTube / audio / video URL, can be added to the voice.'
      );
    }
    if (files?.length) {
      // Dropped files are identity media for every avatar; only microphone
      // takes of the script go straight to the corpus endpoint.
      await submitVoiceMediaUpload(files);
      return;
    }
    if (droppedUrlText.trim()) {
      await submitVoiceMediaUrl(droppedUrlText);
    }
  };

  const [isRetrying, setIsRetrying] = useState(false);
  const retryProfessional = async () => {
    setIsRetrying(true);
    try {
      const response = await retryAvatarProfessionalVoice(assistantId);
      if (response?.professional_state === 'plan_required') {
        toast.error(
          'ElevenLabs still reports the plan is too low for professional cloning.'
        );
      } else if (response?.professional_state === 'failed') {
        toast.error(
          response?.detail?.professional_error ??
            'Professional voice preparation failed again.'
        );
      } else {
        toast.success('Professional voice preparation resumed.');
      }
      await refresh();
    } catch (retryError) {
      showRequestFailureToast(retryError, {
        fallbackMessage: 'Could not retry.',
      });
    } finally {
      setIsRetrying(false);
    }
  };

  const loadCaptcha = async () => {
    try {
      setCaptcha(await getAvatarVoiceVerification(assistantId));
    } catch (captchaError) {
      showRequestFailureToast(captchaError, {
        fallbackMessage: 'Could not fetch the verification text.',
      });
    }
  };

  const startCaptchaRecording = async () => {
    try {
      recordingRef.current = await recordOneTurn();
      setIsRecordingCaptcha(true);
    } catch {
      toast.error('Could not start recording.');
    }
  };

  const stopCaptchaRecordingAndVerify = async () => {
    const recording = recordingRef.current;
    if (!recording) return;
    recordingRef.current = null;
    setIsRecordingCaptcha(false);
    const file = await recording.stop();
    setIsVerifying(true);
    try {
      await submitAvatarVoiceVerification(assistantId, file);
      toast.success(
        'Verified. Professional voice training has started (3–6 hours).'
      );
      setCaptcha(null);
      await refresh();
    } catch (verifyError) {
      showRequestFailureToast(verifyError, {
        fallbackMessage: 'Verification was not accepted. Try reading it again.',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const collected = status?.collected_seconds ?? 0;
  const instantMinimum = status?.instant_minimum_seconds ?? 60;
  const professionalMinimum = status?.professional_minimum_seconds ?? 1800;
  const professionalState = status?.professional_state ?? 'not_started';
  const hasVoiceModel = Boolean(status?.instant_voice_id);
  const barMax = isPersonalAvatar ? professionalMinimum : instantMinimum;
  // The voice model is trained once, at the minimum, and never rebuilt; the
  // personal avatar keeps collecting only toward the professional voice model.
  const milestones = [
    {
      value: instantMinimum,
      label: `Voice model at ${describeSeconds(instantMinimum)}`,
    },
    ...(isPersonalAvatar
      ? [
          {
            value: professionalMinimum,
            label: `professional voice model at ${describeSeconds(professionalMinimum)}`,
          },
        ]
      : []),
  ];
  const nextMilestone = milestones.find(
    (milestone) => collected < milestone.value
  );
  const voiceClipGroups = React.useMemo(() => {
    const groups = new Map();
    for (const clip of status?.clips ?? []) {
      const name = clip.source_document_name || 'Recording';
      const existing = groups.get(name) ?? {
        name,
        seconds: 0,
        sourceLabel: clip.source === 'recorder' ? 'Recording' : 'Upload',
      };
      existing.seconds += Number(clip.duration_seconds ?? 0);
      groups.set(name, existing);
    }
    return Array.from(groups.values());
  }, [status]);
  const captchaText =
    captcha?.captcha?.text ??
    captcha?.captcha?.captcha_text ??
    captcha?.captcha?.sentence ??
    (typeof captcha?.captcha === 'string' ? captcha.captcha : null);

  return (
    <div className="mt-6 pt-6 border-t border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h4 className="text-neutral-200 font-semibold flex items-center gap-2">
          <AudioLines size={18} aria-hidden="true" />
          Voice
        </h4>
        <div className="flex items-center gap-2 text-xs">
          {hasVoiceModel ? (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300"
              title="Text-to-speech replies use this voice. The model is trained once and never rebuilt."
            >
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
              Voice model trained and available
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/10 text-white/60">
              No voice model yet · {describeSeconds(collected)} of{' '}
              {describeSeconds(instantMinimum)}
            </span>
          )}
          {isPersonalAvatar && (
            <span
              className={`px-2.5 py-1 rounded-full border ${
                professionalState === 'fine_tuned'
                  ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                  : professionalState === 'failed'
                    ? 'bg-red-500/20 border-red-500/30 text-red-300'
                    : professionalState === 'plan_required'
                      ? 'bg-amber-400/15 border-amber-400/30 text-amber-300'
                      : 'bg-white/10 border-white/10 text-white/60'
              }`}
            >
              Professional:{' '}
              {STATE_LABELS[professionalState] ?? professionalState}
            </span>
          )}
        </div>
      </div>

      <div className="mb-1 flex items-center justify-between text-xs text-white/60">
        <span>
          {describeSeconds(collected)} of {avatarName ?? 'the avatar'} speaking
          collected
        </span>
        {nextMilestone && (
          <span className="text-white/40">
            {describeSeconds(Math.max(0, nextMilestone.value - collected))} to{' '}
            {nextMilestone.label.split(' at ')[0].toLowerCase()}
          </span>
        )}
      </div>
      <ProgressBar
        value={collected}
        max={barMax}
        milestones={milestones}
        label="Voice collected"
        className="mb-4"
      />

      {/* The rules of the voice, in the panel itself: what an upload does, how
          the reference clip is chosen, when the model is trained, and what
          deleting does. The owner should not have to guess any of this. */}
      <details className="mb-4 rounded-xl bg-black/40 border border-white/10 p-3 text-xs text-white/60 open:pb-4">
        <summary className="cursor-pointer select-none font-semibold text-white/70">
          How the voice works
        </summary>
        <ul className="mt-2 space-y-1.5 list-disc pl-4">
          <li>
            Every audio or video of {avatarName ?? 'the avatar'} speaking —
            dropped here or in Upload — does three things: what was said is
            added to what the avatar knows, the avatar's speech is added to the
            voice model, and the first upload becomes the reference audio.
          </li>
          <li>
            The reference audio is a short single-speaker clip the diarizer uses
            to find {avatarName ?? 'the avatar'} in later recordings. The clip
            is cut from whoever speaks the most in that upload, so a recording
            where someone else talks first is fine as long as{' '}
            {avatarName ?? 'the avatar'} speaks more.
          </li>
          <li>
            Later uploads never replace the reference. To change the reference,
            delete the reference upload and the next upload takes its place.
          </li>
          <li>
            The voice model is trained once {describeSeconds(instantMinimum)} of
            speech is collected, and is never rebuilt after that.
            {isPersonalAvatar
              ? ` Your own avatar keeps collecting toward a professional voice model at ${describeSeconds(professionalMinimum)}.`
              : ' Later uploads still update what the avatar knows.'}
          </li>
          <li>
            Deleting an upload removes its seconds from the count. A voice model
            that already exists is kept.
          </li>
          <li>
            Only audio or video files, YouTube links, and direct audio/video
            URLs are accepted here.
          </li>
        </ul>
      </details>

      {/* What the voice is built from: the reference clip the diarizer uses
          to find this avatar in recordings, and every upload whose speech
          reached the model. */}
      <div className="mb-4 rounded-xl bg-black/40 border border-white/10 p-3">
        <p className="text-xs font-semibold text-white/70 mb-1.5">
          What feeds the voice model
        </p>
        <p className="text-xs text-white/60 mb-2">
          {status?.reference_audio_document ? (
            <>
              Reference audio:{' '}
              <span className="text-emerald-200">
                {status.reference_audio_document}
              </span>
            </>
          ) : (
            'No reference audio yet — the first audio or video upload becomes the reference.'
          )}
        </p>
        {voiceClipGroups.length > 0 ? (
          <ul className="space-y-1">
            {voiceClipGroups.map((group) => (
              <li
                key={group.name}
                className="flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <span className="min-w-0 truncate text-neutral-200">
                  {group.name}
                  <span className="text-white/40">
                    {' '}
                    · {group.sourceLabel} · {describeSeconds(group.seconds)}
                  </span>
                </span>
                {group.name === status?.reference_audio_document && (
                  <span className="px-2 py-0.5 rounded-full border border-emerald-400/40 text-emerald-200 text-[11px] font-semibold uppercase tracking-wide">
                    Reference
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-white/40">
            Nothing collected yet. Upload audio or video of{' '}
            {avatarName ?? 'the avatar'} speaking, or paste a video URL.
          </p>
        )}
        {hasVoiceModel && (
          <p className="mt-2 text-[11px] text-white/40">
            The voice model was trained from the first{' '}
            {describeSeconds(status?.instant_voice_seconds ?? instantMinimum)}{' '}
            and is never rebuilt
            {isPersonalAvatar
              ? '; later speech counts toward the professional voice model.'
              : '; later uploads still update what the avatar knows.'}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-start">
        {isPersonalAvatar && (
          <div className="rounded-xl bg-black/50 border border-white/10 p-4">
            <p className="text-white/50 text-xs mb-2">
              Read this aloud, one line at a time ({scriptIndex + 1}/
              {RECORDING_SCRIPT.length}). Hold the button while you speak.
            </p>
            <p className="text-neutral-200 leading-relaxed min-h-[3.5rem]">
              {RECORDING_SCRIPT[scriptIndex]}
            </p>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onMouseLeave={() => isRecording && stopRecording()}
                onTouchStart={(event) => {
                  event.preventDefault();
                  startRecording();
                }}
                onTouchEnd={(event) => {
                  event.preventDefault();
                  stopRecording();
                }}
                disabled={isUploading}
                aria-label={isRecording ? 'Stop and save' : 'Hold to record'}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all disabled:opacity-40 ${
                  isRecording
                    ? 'bg-red-500 scale-110 shadow-[0_0_24px_rgba(239,68,68,0.6)]'
                    : 'bg-neutral-200 hover:bg-neutral-100'
                }`}
              >
                {isRecording ? (
                  <Square className="w-5 h-5 text-neutral-100" />
                ) : isUploading ? (
                  <Loader2 className="w-6 h-6 text-neutral-900 animate-spin" />
                ) : (
                  <Mic className="w-6 h-6 text-neutral-900" />
                )}
              </button>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    setScriptIndex((index) => Math.max(0, index - 1))
                  }
                  className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 border border-white/10"
                >
                  Previous line
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setScriptIndex((index) =>
                      Math.min(RECORDING_SCRIPT.length - 1, index + 1)
                    )
                  }
                  className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 border border-white/10"
                >
                  Next line
                </button>
              </div>
            </div>
          </div>
        )}

        <Dropzone
          onDrop={handleDrop}
          multiple
          accept={{ 'audio/*': [], 'video/*': [] }}
          noDragEventsBubbling
        >
          {({ getRootProps, getInputProps }) => (
            <div
              {...getRootProps()}
              onPaste={(event) => {
                const text = event.clipboardData.getData('text/plain');
                if (!singleReferenceAudioUrl(text).url) return;
                event.preventDefault();
                event.stopPropagation();
                submitVoiceMediaUrl(text);
              }}
              className={`h-full min-h-[7rem] border-2 border-dashed border-white/20 hover:border-white/40 rounded-xl bg-black/40 flex flex-col items-center justify-center gap-1 p-3 text-center cursor-pointer transition-colors ${
                isPersonalAvatar ? 'w-full md:w-44' : 'w-full'
              }`}
            >
              <input {...getInputProps()} />
              <Upload size={20} className="text-white/50" aria-hidden="true" />
              <span className="text-xs text-white/60">
                {isPersonalAvatar
                  ? `Or drop audio, video, or a video URL of ${avatarName ?? 'the avatar'} speaking`
                  : `Upload audio, video, or a video URL of ${avatarName ?? 'the avatar'} speaking`}
              </span>
            </div>
          )}
        </Dropzone>
      </div>

      <div className="mt-3 flex flex-col sm:flex-row gap-2">
        <input
          type="url"
          inputMode="url"
          autoComplete="url"
          spellCheck={false}
          placeholder="https://youtube.com/watch?v=… or a direct video/audio URL"
          value={referenceUrl}
          disabled={isUploading}
          onChange={(event) => setReferenceUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              if (referenceUrl.trim()) submitVoiceMediaUrl(referenceUrl);
            }
          }}
          className="w-full min-w-0 sm:flex-1 px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-sm text-neutral-200 placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => submitVoiceMediaUrl(referenceUrl)}
          disabled={isUploading || !referenceUrl.trim()}
          className="px-3 py-2 bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 border border-amber-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUploading ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <Link size={16} aria-hidden="true" />
          )}
          Add to voice
        </button>
      </div>
      <p className="mt-1.5 text-xs text-white/40">
        Speech in a YouTube video or a direct audio/video link is added to this
        avatar's voice model and to what the avatar knows. The first upload is
        also the reference audio.
      </p>

      {voiceJobs.length > 0 && (
        <div className="mt-3 space-y-3">
          {voiceJobs.map((job) => (
            <UploadProcessPanel
              key={job.localId}
              job={job}
              onCancel={() => onCancelJob?.(job.localId)}
              onCancelItem={(itemJobId) =>
                onCancelJob?.(job.localId, itemJobId)
              }
              onDismiss={() => onDismissJob?.(job.localId)}
            />
          ))}
        </div>
      )}

      {isPersonalAvatar && professionalState === 'awaiting_verification' && (
        <div className="mt-4 rounded-xl bg-amber-400/10 border border-amber-400/30 p-4">
          <p className="text-amber-200 text-sm font-medium flex items-center gap-2 mb-2">
            <ShieldCheck size={16} aria-hidden="true" />
            Verify it is your voice
          </p>
          <p className="text-white/60 text-xs mb-3">
            ElevenLabs requires the owner to read a short phrase aloud before a
            professional voice model is trained. Fetch the phrase, hold the
            button while you read it, and let go.
          </p>
          {!captcha ? (
            <button
              type="button"
              onClick={loadCaptcha}
              className="px-3 py-1.5 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 text-sm border border-amber-400/30 transition-colors"
            >
              Show the phrase
            </button>
          ) : (
            <div className="space-y-3">
              {captchaText ? (
                <p className="text-neutral-200 bg-black/50 border border-white/10 rounded-lg px-3 py-2">
                  {captchaText}
                </p>
              ) : (
                <pre className="text-neutral-300 text-xs bg-black/50 border border-white/10 rounded-lg px-3 py-2 whitespace-pre-wrap">
                  {JSON.stringify(captcha?.captcha, null, 2)}
                </pre>
              )}
              <button
                type="button"
                onMouseDown={startCaptchaRecording}
                onMouseUp={stopCaptchaRecordingAndVerify}
                onTouchStart={(event) => {
                  event.preventDefault();
                  startCaptchaRecording();
                }}
                onTouchEnd={(event) => {
                  event.preventDefault();
                  stopCaptchaRecordingAndVerify();
                }}
                disabled={isVerifying}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40 ${
                  isRecordingCaptcha
                    ? 'bg-red-500 text-neutral-100'
                    : 'bg-neutral-200 hover:bg-neutral-100 text-neutral-900'
                }`}
              >
                {isVerifying ? (
                  <Loader2
                    className="w-4 h-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Mic className="w-4 h-4" aria-hidden="true" />
                )}
                {isVerifying
                  ? 'Verifying…'
                  : isRecordingCaptcha
                    ? 'Release to submit'
                    : 'Hold and read the phrase'}
              </button>
            </div>
          )}
        </div>
      )}

      {isPersonalAvatar && professionalState === 'plan_required' && (
        <div className="mt-4 rounded-xl bg-amber-400/10 border border-amber-400/30 p-4">
          <p className="text-amber-200 text-sm font-medium mb-2">
            Professional cloning needs the ElevenLabs Creator plan
          </p>
          <p className="text-white/60 text-xs mb-3">
            ElevenLabs refused to create the professional voice:{' '}
            <span className="text-white/80">
              {status?.detail?.professional_error ??
                'the account plan is too low.'}
            </span>{' '}
            The voice audio model keeps working. Upgrade the ElevenLabs account,
            then retry.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={retryProfessional}
              disabled={isRetrying}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 text-sm border border-amber-400/30 transition-colors disabled:opacity-40"
            >
              {isRetrying ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
              )}
              Retry
            </button>
            {status?.detail?.professional_help_url && (
              <a
                href={status.detail.professional_help_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-white/60 hover:text-white/90 underline underline-offset-2"
              >
                ElevenLabs professional voice cloning guide
              </a>
            )}
          </div>
        </div>
      )}

      {isPersonalAvatar && professionalState === 'training' && (
        <p className="mt-3 text-white/50 text-xs">
          Professional voice training started
          {status?.training_started_at
            ? ` ${new Date(status.training_started_at).toLocaleString()}`
            : ''}
          . It takes three to six hours; the avatar keeps using the voice audio
          model until it finishes.
        </p>
      )}
      {status?.detail?.instant_error && (
        <p className="mt-3 text-red-300 text-xs">
          The voice audio model could not be created:{' '}
          {status.detail.instant_error}
        </p>
      )}
    </div>
  );
};

export default VoicePanel;
