// Optional gender and initial standard voice on Create Avatar.
//
// Left blank, the first stock voice for the gender inferred from the name
// (or female when the name does not decide) is stored after create so voice
// mode can speak before a clone is uploaded. Nothing here plays a sample
// on its own — speech-to-text must not preview as text-to-speech.

import { useEffect, useState } from 'react';
import { Volume2 } from 'lucide-react';

import { inferAvatarGenderFromName } from '../services/avatarGenderFromName';
import {
  CREATE_AVATAR_GENDER_OPTIONS,
  effectiveCreateAvatarGender,
} from '../services/createAvatarVoice';
import { listStandardVoices } from '../services/avatarService';

/**
 * @param {Object} props
 * @param {string} props.avatarName Name already typed (or resolved).
 * @param {string} props.gender '' | 'female' | 'male'
 * @param {string} props.voiceId Selected catalogue id, or ''.
 * @param {boolean} [props.disabled]
 * @param {(gender: string) => void} props.onGenderChange
 * @param {(voiceId: string) => void} props.onVoiceChange
 * @param {(voices: Array) => void} [props.onVoicesChange]
 */
const CreateAvatarVoiceField = ({
  avatarName,
  gender,
  voiceId,
  disabled = false,
  onGenderChange,
  onVoiceChange,
  onVoicesChange,
}) => {
  const [voices, setVoices] = useState([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [loadError, setLoadError] = useState('');
  const inferredGender = inferAvatarGenderFromName(avatarName);
  const catalogueGender = effectiveCreateAvatarGender({
    selectedGender: gender,
    avatarName,
  });

  useEffect(() => {
    let cancelled = false;
    setIsLoadingVoices(true);
    setLoadError('');
    listStandardVoices(catalogueGender)
      .then((catalogue) => {
        if (cancelled) return;
        setVoices(catalogue);
        onVoicesChange?.(catalogue);
        onVoiceChange(
          catalogue.some((voice) => voice.voice_id === voiceId) ? voiceId : ''
        );
      })
      .catch((catalogueError) => {
        if (cancelled) return;
        console.debug('Standard voices unavailable:', catalogueError);
        setVoices([]);
        onVoicesChange?.([]);
        setLoadError('Standard voices could not be loaded right now.');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingVoices(false);
      });
    return () => {
      cancelled = true;
    };
    // voiceId is read to keep a still-valid pick; the load key is gender.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogueGender]);

  const inferredLabel =
    inferredGender === 'female'
      ? 'female'
      : inferredGender === 'male'
        ? 'male'
        : null;

  return (
    <div className="mb-4">
      <p className="text-xl sm:text-2xl text-neutral-300">
        Voice
        <span className="ml-2 text-sm font-normal text-white/40">Optional</span>
      </p>
      <p className="mt-1 mb-2 text-xs leading-relaxed text-white/40">
        Spoken in voice mode until a cloned voice is uploaded.
        {inferredLabel && !gender
          ? ` “${avatarName.trim()}” reads as ${inferredLabel}; the first matching stock voice is used if you leave this blank.`
          : ' Leave blank and the first stock voice for the inferred gender is used.'}
      </p>
      <div
        className="mb-2 inline-flex rounded-lg border border-neutral-700 bg-black/60 p-0.5"
        role="radiogroup"
        aria-label="Voice gender"
      >
        {CREATE_AVATAR_GENDER_OPTIONS.map((option) => (
          <button
            key={option.value || 'unspecified'}
            type="button"
            role="radio"
            aria-checked={gender === option.value}
            disabled={disabled}
            onClick={() => onGenderChange(option.value)}
            className={`px-2.5 py-1 text-xs rounded-md transition disabled:opacity-50 ${
              gender === option.value
                ? 'bg-white/15 text-white'
                : 'text-white/60 hover:text-white'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <label className="block text-sm text-neutral-300">
        <span className="sr-only">Initial standard voice</span>
        <span className="inline-flex items-center gap-1.5 text-xs text-white/50">
          <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
          Initial stock voice
        </span>
        <select
          value={voiceId || voices[0]?.voice_id || ''}
          disabled={disabled || isLoadingVoices || voices.length === 0}
          onChange={(changeEvent) => onVoiceChange(changeEvent.target.value)}
          className="mt-1 w-full rounded bg-black/60 p-2 text-sm text-neutral-200 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:opacity-50"
        >
          {isLoadingVoices || voices.length === 0 ? (
            <option value="">
              {isLoadingVoices ? 'Loading voices…' : 'No voices available'}
            </option>
          ) : (
            voices.map((voice) => (
              <option key={voice.voice_id} value={voice.voice_id}>
                {voice.name ?? voice.voice_id}
              </option>
            ))
          )}
        </select>
      </label>
      {loadError ? (
        <p className="mt-1.5 text-[11px] text-amber-200">{loadError}</p>
      ) : null}
    </div>
  );
};

export default CreateAvatarVoiceField;
