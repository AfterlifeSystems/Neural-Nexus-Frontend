// src/components/voice/VoicePanel.jsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Dropzone from 'react-dropzone';
import { toast } from 'react-hot-toast';
import {
  AudioLines,
  Check,
  Loader2,
  Mic,
  RefreshCw,
  ShieldCheck,
  Square,
  Upload,
} from 'lucide-react';
import ProgressBar from '../ui/ProgressBar';
import {
  addAvatarVoiceSample,
  getAvatarVoice,
  getAvatarVoiceVerification,
  retryAvatarProfessionalVoice,
  streamMediaJobProgress,
  submitAvatarVoiceVerification,
  uploadAvatarIdentityMedia,
} from '../../services/avatarService';
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
 * The avatar's voice: record it, watch the corpus fill, verify the professional clone.
 *
 * Every avatar gets a voice audio model (the instant clone) once a minute of
 * its speech is collected (rebuilt at two minutes). The personal avatar keeps
 * collecting — from this recorder and from every audio or video uploaded of
 * the owner — toward the thirty minutes a professional clone needs; when that
 * is reached the panel shows the CAPTCHA the owner reads aloud, and training
 * starts on submit.
 *
 * @param {Object} parameters
 * @param {string} parameters.assistantId The avatar.
 * @param {boolean} parameters.isPersonalAvatar Whether the professional path applies.
 * @param {string} [parameters.avatarName] For labels.
 */
const VoicePanel = ({ assistantId, isPersonalAvatar, avatarName }) => {
  const [status, setStatus] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
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
  }, [refresh]);

  useEffect(() => () => recordingRef.current?.cancel(), []);

  const submitRecording = async (file, description) => {
    setIsUploading(true);
    try {
      const isFirstTake = (status?.collected_seconds ?? 0) === 0;
      const response = await addAvatarVoiceSample(assistantId, file);
      setStatus(response);
      const added = Math.round(response?.added_seconds ?? 0);
      toast.success(
        added > 0
          ? `${added}s of ${avatarName ?? 'the avatar'} speaking added.`
          : `${description} added.`
      );
      if (response?.instant_voice_id && !status?.instant_voice_id) {
        toast.success('Voice audio model ready — the avatar can speak now.');
      }
      // The first take is also the voice audio model the diarizer and instant
      // clone are built from. Later takes only grow the clone corpus.
      if (isFirstTake) {
        uploadAvatarIdentityMedia({
          assistantId,
          files: [file],
          isReferenceAudio: true,
        }).catch(() => {});
      }
    } catch (uploadError) {
      showRequestFailureToast(uploadError, {
        fallbackMessage: `${description} could not be added.`,
      });
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Non-personal avatars accept uploaded speech as identity media that is also
   * the voice reference — there is no live person to record from.
   */
  const submitReferenceUpload = async (file) => {
    setIsUploading(true);
    try {
      const uploadResponse = await uploadAvatarIdentityMedia({
        assistantId,
        files: [file],
        isReferenceAudio: true,
      });
      const jobId = uploadResponse?.job_id;
      if (jobId) {
        await streamMediaJobProgress(jobId, () => {});
      }
      try {
        await addAvatarVoiceSample(assistantId, file);
      } catch {
        // The identity upload already stored the reference; clone corpus is extra.
      }
      await refresh();
      toast.success(`${file.name} stored as the voice audio model.`);
    } catch (uploadError) {
      showRequestFailureToast(uploadError, {
        fallbackMessage: `${file.name} could not be added.`,
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

  const handleDrop = async (files) => {
    const [file] = files ?? [];
    if (!file) return;
    if (!isPersonalAvatar) {
      await submitReferenceUpload(file);
      return;
    }
    await submitRecording(file, file.name);
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
  const instantTarget = status?.instant_target_seconds ?? 120;
  const professionalMinimum = status?.professional_minimum_seconds ?? 1800;
  const professionalState = status?.professional_state ?? 'not_started';
  const barMax = isPersonalAvatar ? professionalMinimum : instantTarget;
  const milestones = [
    {
      value: instantMinimum,
      label: `Voice audio model at ${describeSeconds(instantMinimum)}`,
    },
    {
      value: instantTarget,
      label: `Better voice audio model at ${describeSeconds(instantTarget)}`,
    },
    ...(isPersonalAvatar
      ? [
          {
            value: professionalMinimum,
            label: `Professional clone at ${describeSeconds(professionalMinimum)}`,
          },
        ]
      : []),
  ];
  const nextMilestone = milestones.find(
    (milestone) => collected < milestone.value
  );
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
          {status?.instant_voice_id ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300">
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
              Vocal audio model
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/10 text-white/60">
              No vocal audio model yet
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
          multiple={false}
          accept={{ 'audio/*': [], 'video/*': [] }}
          noDragEventsBubbling
        >
          {({ getRootProps, getInputProps }) => (
            <div
              {...getRootProps()}
              className={`h-full min-h-[7rem] border-2 border-dashed border-white/20 hover:border-white/40 rounded-xl bg-black/40 flex flex-col items-center justify-center gap-1 p-3 text-center cursor-pointer transition-colors ${
                isPersonalAvatar ? 'w-full md:w-44' : 'w-full'
              }`}
            >
              <input {...getInputProps()} />
              <Upload size={20} className="text-white/50" aria-hidden="true" />
              <span className="text-xs text-white/60">
                {isPersonalAvatar
                  ? `Or drop a recording of ${avatarName ?? 'the avatar'} speaking`
                  : `Upload audio or video of ${avatarName ?? 'the avatar'} speaking`}
              </span>
            </div>
          )}
        </Dropzone>
      </div>

      {isPersonalAvatar && professionalState === 'awaiting_verification' && (
        <div className="mt-4 rounded-xl bg-amber-400/10 border border-amber-400/30 p-4">
          <p className="text-amber-200 text-sm font-medium flex items-center gap-2 mb-2">
            <ShieldCheck size={16} aria-hidden="true" />
            Verify it is your voice
          </p>
          <p className="text-white/60 text-xs mb-3">
            ElevenLabs requires the owner to read a short phrase aloud before a
            professional clone is trained. Fetch the phrase, hold the button
            while you read it, and let go.
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
