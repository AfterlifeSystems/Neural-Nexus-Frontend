// src/components/voice/StandardVoicePicker.jsx
//
// Lets the owner choose a stock vendor voice for the avatar to speak with
// while it has no usable cloned voice: pick the gender that matches the
// avatar, listen to a sample, and use the voice. A cloned voice, once usable,
// always speaks ahead of this choice, so the card says so when a clone exists.
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Check, Loader2, Play, Square, Volume2 } from 'lucide-react';
import {
  listStandardVoices,
  setAvatarStandardVoice,
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
 * @param {boolean} props.hasUsableCloneVoice Whether a cloned voice speaks
 *   today; the standard voice then waits in reserve.
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
  }, [gender]);

  const stopPreview = () => {
    const audio = previewAudioRef.current;
    if (audio) {
      audio.pause();
      audio.src = '';
      previewAudioRef.current = null;
    }
    setPreviewingVoiceId('');
  };

  useEffect(() => stopPreview, []);

  const previewVoice = (voice) => {
    if (previewingVoiceId === voice.voice_id) {
      stopPreview();
      return;
    }
    stopPreview();
    if (!voice.preview_url) {
      toast.error('No sample is available for that voice.', {
        id: 'standard-voice-preview',
      });
      return;
    }
    const audio = new Audio(voice.preview_url);
    previewAudioRef.current = audio;
    setPreviewingVoiceId(voice.voice_id);
    audio.addEventListener('ended', stopPreview, { once: true });
    audio.addEventListener('error', stopPreview, { once: true });
    audio.play().catch(stopPreview);
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

  const selectedVoice =
    voices.find((voice) => voice.voice_id === selectedVoiceId) ?? null;
  const selectedIsChosen = Boolean(
    chosen && selectedVoiceId && chosen.voice_id === selectedVoiceId
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
        {hasUsableCloneVoice
          ? 'The cloned voice speaks. A standard voice stands in only if the cloned voice becomes unavailable.'
          : 'Until a cloned voice is ready, the avatar can speak with a stock voice. Pick the gender that matches the avatar, then a voice.'}
      </p>

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
