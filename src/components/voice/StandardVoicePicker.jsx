// src/components/voice/StandardVoicePicker.jsx
//
// Lets the owner choose a stock vendor voice for the avatar to speak with:
// pick the gender that matches the avatar, listen to a sample, and use the
// voice. Using a standard voice makes the standard voice speak even when a
// cloned voice exists; when a cloned voice exists, a switch lets the owner
// choose between the custom (cloned) voice and the standard voice.
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Check, Loader2, Play, Square, Volume2 } from 'lucide-react';
import {
  fetchStandardVoicePreview,
  listStandardVoices,
  setAvatarStandardVoice,
  setAvatarVoiceChoice,
} from '../../services/avatarService';
import { inferAvatarGenderFromName } from '../../services/avatarGenderFromName';
import { showRequestFailureToast } from '../requestFailureToast';

const GENDER_OPTIONS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
];

const capitalize = (text) =>
  typeof text === 'string' && text.length > 0
    ? text.charAt(0).toUpperCase() + text.slice(1)
    : '';

const describeVoice = (voice) => {
  const traits = [voice.accent, voice.age, voice.description]
    .map(capitalize)
    .filter(Boolean);
  return traits.length > 0 ? `${voice.name} · ${traits.join(', ')}` : voice.name;
};

/**
 * @param {Object} props
 * @param {string} props.assistantId The avatar.
 * @param {Object|null} props.status The voice status from GET /avatar_voice.
 * @param {(status: Object) => void} props.onStatus Receives the status the
 *   save returned, so the panel re-renders without a second read.
 * @param {boolean} props.hasUsableCloneVoice Whether a usable cloned voice
 *   exists to choose instead of the standard voice.
 * @param {string} [props.avatarName] Used to infer gender when none is saved.
 */
const StandardVoicePicker = ({
  assistantId,
  status,
  onStatus,
  hasUsableCloneVoice,
  avatarName,
}) => {
  const chosen = status?.standard_voice ?? null;
  const standardIsSpeaking = Boolean(chosen) && status?.voice_choice === 'standard';
  const customVoiceAvailable =
    hasUsableCloneVoice || status?.custom_voice_available === true;
  const [isSwitchingVoice, setIsSwitchingVoice] = useState(false);
  const [gender, setGender] = useState(
    chosen?.gender ?? inferAvatarGenderFromName(avatarName) ?? 'female'
  );
  const [voices, setVoices] = useState([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [selectedVoiceId, setSelectedVoiceId] = useState(chosen?.voice_id ?? '');
  const [previewingVoiceId, setPreviewingVoiceId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const previewAudioRef = useRef(null);
  // Object URL of a sample fetched through the API (a vendor whose sample
  // address needs the API key), released when the sample stops.
  const previewObjectUrlRef = useRef(null);
  // Bumped on every stop, so a sample fetch that resolves after the owner
  // stopped or picked another voice is dropped instead of played.
  const previewRequestNumberRef = useRef(0);
  // The provider (ElevenLabs, Cartesia) the catalogue comes from; the list is
  // read again when the server's voice provider is switched.
  const voiceProvider = status?.voice_provider ?? null;

  // Follow the saved choice when the status arrives after mount.
  useEffect(() => {
    if (chosen?.gender) setGender(chosen.gender);
    setSelectedVoiceId(chosen?.voice_id ?? '');
  }, [chosen?.gender, chosen?.voice_id]);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingVoices(true);
    setLoadError('');
    listStandardVoices(gender)
      .then((catalogue) => {
        if (cancelled) return;
        setVoices(catalogue);
        setSelectedVoiceId((current) =>
          catalogue.some((voice) => voice.voice_id === current)
            ? current
            : (catalogue[0]?.voice_id ?? '')
        );
      })
      .catch((catalogueError) => {
        if (cancelled) return;
        console.debug('Standard voices unavailable:', catalogueError);
        setVoices([]);
        setLoadError('The standard voices could not be loaded right now.');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingVoices(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gender, voiceProvider]);

  const stopPreview = () => {
    previewRequestNumberRef.current += 1;
    const audio = previewAudioRef.current;
    if (audio) {
      audio.pause();
      audio.src = '';
      previewAudioRef.current = null;
    }
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
    setPreviewingVoiceId('');
  };

  const playPreviewFrom = (voiceId, sampleUrl) => {
    const audio = new Audio(sampleUrl);
    previewAudioRef.current = audio;
    setPreviewingVoiceId(voiceId);
    audio.addEventListener('ended', stopPreview, { once: true });
    audio.addEventListener('error', stopPreview, { once: true });
    audio.play().catch(stopPreview);
  };

  useEffect(() => stopPreview, []);

  const previewVoice = (voice) => {
    if (previewingVoiceId === voice.voice_id) {
      stopPreview();
      return;
    }
    stopPreview();
    if (voice.preview_requires_auth) {
      // The vendor's sample needs the API key, so the API serves the sample.
      setPreviewingVoiceId(voice.voice_id);
      const previewRequestNumber = previewRequestNumberRef.current;
      fetchStandardVoicePreview(voice.voice_id)
        .then((sampleBlob) => {
          if (previewRequestNumber !== previewRequestNumberRef.current) return;
          const sampleObjectUrl = URL.createObjectURL(sampleBlob);
          previewObjectUrlRef.current = sampleObjectUrl;
          playPreviewFrom(voice.voice_id, sampleObjectUrl);
        })
        .catch((previewError) => {
          if (previewRequestNumber !== previewRequestNumberRef.current) return;
          console.debug('Standard voice sample unavailable:', previewError);
          stopPreview();
          toast.error('No sample is available for that voice.', {
            id: 'standard-voice-preview',
          });
        });
      return;
    }
    if (!voice.preview_url) {
      toast.error('No sample is available for that voice.', {
        id: 'standard-voice-preview',
      });
      return;
    }
    playPreviewFrom(voice.voice_id, voice.preview_url);
  };

  const save = async (voiceId) => {
    setIsSaving(true);
    try {
      const nextStatus = await setAvatarStandardVoice(assistantId, voiceId);
      onStatus?.(nextStatus);
      const savedVoice = nextStatus?.standard_voice;
      toast.success(
        savedVoice
          ? `${savedVoice.name} is now this avatar's standard voice.`
          : 'The standard voice was cleared.'
      );
    } catch (saveError) {
      showRequestFailureToast(saveError, {
        fallbackMessage: 'Could not save the standard voice.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const chooseVoice = async (choice) => {
    setIsSwitchingVoice(true);
    try {
      const nextStatus = await setAvatarVoiceChoice(assistantId, choice);
      onStatus?.(nextStatus);
      toast.success(
        choice === 'custom'
          ? 'The avatar now speaks with its custom voice.'
          : `The avatar now speaks with ${chosen?.name ?? 'the standard voice'}.`
      );
    } catch (choiceError) {
      showRequestFailureToast(choiceError, {
        fallbackMessage: 'Could not change which voice the avatar speaks with.',
      });
    } finally {
      setIsSwitchingVoice(false);
    }
  };

  const selectedVoice =
    voices.find((voice) => voice.voice_id === selectedVoiceId) ?? null;
  // "In use" only while the picked voice is the one speaking. A picked voice
  // held in reserve behind the custom voice can be used again with one press.
  const selectedIsChosen = Boolean(
    standardIsSpeaking && selectedVoiceId && chosen.voice_id === selectedVoiceId
  );

  return (
    <div className="mb-4 rounded-xl bg-black/40 border border-white/10 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
        <p className="text-xs font-semibold text-white/70 flex items-center gap-1.5">
          <Volume2 size={14} aria-hidden="true" />
          Standard voice
        </p>
        {chosen ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-400/30 bg-amber-400/15 text-amber-300 text-[11px]">
            <Check className="w-3 h-3" aria-hidden="true" />
            {chosen.name ?? 'Chosen'}
          </span>
        ) : null}
      </div>
      <p className="text-xs text-white/60 mb-2">
        {customVoiceAvailable
          ? standardIsSpeaking
            ? `The avatar speaks with the standard voice ${chosen.name ?? ''}. Choose the custom voice to hear the cloned voice again.`
            : 'The avatar speaks with its custom (cloned) voice. Use a standard voice here to speak with that voice instead.'
          : 'Until a cloned voice is ready, the avatar can speak with a stock voice. Pick the gender that matches the avatar, then a voice.'}
      </p>

      {customVoiceAvailable && chosen ? (
        <div
          className="mb-2 inline-flex rounded-lg border border-white/15 bg-black/30 p-0.5"
          role="radiogroup"
          aria-label="Voice the avatar speaks with"
        >
          {[
            { value: 'custom', label: 'Custom voice' },
            { value: 'standard', label: `Standard · ${chosen.name ?? 'voice'}` },
          ].map((option) => {
            const isActive =
              option.value === 'standard' ? standardIsSpeaking : !standardIsSpeaking;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={isActive}
                disabled={isSwitchingVoice || isActive}
                onClick={() => chooseVoice(option.value)}
                className={`px-2.5 py-1 text-xs rounded-md transition inline-flex items-center gap-1 ${
                  isActive
                    ? 'bg-amber-400/20 text-amber-200'
                    : 'text-white/60 hover:text-white'
                } disabled:cursor-default`}
              >
                {isSwitchingVoice && !isActive ? (
                  <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                ) : null}
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <div
        className="mb-2 inline-flex rounded-lg border border-white/15 bg-black/30 p-0.5"
        role="radiogroup"
        aria-label="Voice gender"
      >
        {GENDER_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={gender === option.value}
            onClick={() => {
              stopPreview();
              setGender(option.value);
            }}
            className={`px-2.5 py-1 text-xs rounded-md transition ${
              gender === option.value
                ? 'bg-white/15 text-white'
                : 'text-white/60 hover:text-white'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`standard-voice-${assistantId}`}>
          Standard voice
        </label>
        <select
          id={`standard-voice-${assistantId}`}
          value={selectedVoiceId}
          disabled={isLoadingVoices || voices.length === 0}
          onChange={(event) => {
            stopPreview();
            setSelectedVoiceId(event.target.value);
          }}
          className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-white disabled:opacity-50"
        >
          {voices.length === 0 ? (
            <option value="">
              {isLoadingVoices ? 'Loading voices…' : 'No voices available'}
            </option>
          ) : (
            voices.map((voice) => (
              <option key={voice.voice_id} value={voice.voice_id}>
                {describeVoice(voice)}
              </option>
            ))
          )}
        </select>
        <button
          type="button"
          disabled={!selectedVoice}
          onClick={() => selectedVoice && previewVoice(selectedVoice)}
          aria-label={
            previewingVoiceId === selectedVoiceId
              ? 'Stop the sample'
              : 'Play a sample'
          }
          className="inline-flex items-center gap-1 rounded-lg border border-white/20 px-2.5 py-1.5 text-xs text-white/80 transition hover:bg-white/10 disabled:opacity-50"
        >
          {previewingVoiceId === selectedVoiceId ? (
            <Square size={12} aria-hidden="true" />
          ) : (
            <Play size={12} aria-hidden="true" />
          )}
          {previewingVoiceId === selectedVoiceId ? 'Stop' : 'Sample'}
        </button>
        <button
          type="button"
          disabled={!selectedVoice || isSaving || selectedIsChosen}
          onClick={() => save(selectedVoiceId)}
          className="inline-flex items-center gap-1 rounded-lg border border-amber-400/30 bg-amber-400/15 px-2.5 py-1.5 text-xs text-amber-300 transition hover:bg-amber-400/25 disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2 size={12} className="animate-spin" aria-hidden="true" />
          ) : null}
          {selectedIsChosen ? 'In use' : 'Use this voice'}
        </button>
        {chosen ? (
          <button
            type="button"
            disabled={isSaving}
            onClick={() => save(null)}
            className="rounded-lg px-2 py-1.5 text-xs text-white/50 transition hover:text-white disabled:opacity-50"
          >
            Clear
          </button>
        ) : null}
      </div>
      {loadError ? (
        <p className="mt-1.5 text-[11px] text-amber-200">{loadError}</p>
      ) : null}
    </div>
  );
};

export default StandardVoicePicker;
