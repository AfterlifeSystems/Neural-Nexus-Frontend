// src/components/voice/VoiceCaptureNotice.jsx
import React, { useState } from 'react';
import { Mic, Sparkles } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { setVoiceCaptureConsent } from '../../services/avatarService';
import { avatarHasClonedVoice } from '../../services/avatarHasClonedVoice';

/**
 * The one line voice mode shows about the avatar learning its own voice.
 *
 * Three situations, and nothing at all in every other case — this sits under a
 * live conversation, so it earns its place only when the person can act on it
 * or when something is genuinely changing:
 *
 * 1. **Never asked.** Talking to a personal avatar can grow its voice from the
 *    owner's own speech. That is asked once, plainly, and the answer is kept.
 *    Declining leaves voice mode working exactly as it did.
 * 2. **No reference recording.** The avatar has no clip to recognise its person
 *    by, so nothing can be attributed and nothing is learned. The way out is a
 *    recording in settings, an upload of the person speaking, or research — so
 *    this says what is missing rather than offering a half-measure here.
 * 3. **Building.** Once it is learning, the progress is worth seeing, because
 *    the voice arrives partway through a conversation.
 *
 * A cloned voice already built shows nothing: the avatar simply speaks.
 * A chosen standard voice does not count as a clone, so learning progress
 * still appears.
 *
 * @param {Object} parameters
 * @param {string} parameters.assistantId The personal avatar.
 * @param {Object|null} parameters.status The voice status from `GET /avatar_voice`.
 * @param {Object|null} [parameters.readiness] The `voice` record from the last
 *   transcription, which carries fresher collected seconds than the status read.
 * @param {Function} [parameters.onAnswered] Called with the updated status.
 * @param {Function} [parameters.onOpenVoiceSettings] Opens the settings Voice panel.
 * @returns {React.ReactElement|null}
 */
export default function VoiceCaptureNotice({
  assistantId,
  status,
  readiness,
  onAnswered,
  onOpenVoiceSettings,
}) {
  const [saving, setSaving] = useState(false);

  if (!status) return null;

  const collected = Number(
    readiness?.collected_seconds ?? status.collected_seconds ?? 0
  );
  const minimum = Number(
    readiness?.instant_minimum_seconds ?? status.instant_minimum_seconds ?? 60
  );
  const hasVoice =
    avatarHasClonedVoice(status) || avatarHasClonedVoice(readiness);
  const reason = status.accrual_blocked_reason;

  const answer = async (granted) => {
    setSaving(true);
    try {
      const updated = await setVoiceCaptureConsent(assistantId, granted);
      onAnswered?.(updated);
      if (granted) {
        toast.success('This avatar will learn your voice as you talk to it.', {
          id: 'voice-capture-consent',
        });
      }
    } catch {
      toast.error('Could not save that choice.', {
        id: 'voice-capture-consent',
      });
    } finally {
      setSaving(false);
    }
  };

  if (reason === 'consent_missing') {
    return (
      <Shell>
        <Mic className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
        <p className="min-w-0 flex-1">
          Let this avatar learn to speak in your voice from what you say here?
          You can change your mind in voice settings.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => answer(true)}
            className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-neutral-900 transition hover:bg-white disabled:opacity-50"
          >
            Learn my voice
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => answer(false)}
            className="rounded-full border border-white/30 px-3 py-1 text-xs font-medium transition hover:bg-white/10 disabled:opacity-50"
          >
            Not now
          </button>
        </div>
      </Shell>
    );
  }

  if (reason === 'reference_audio_missing') {
    return (
      <Shell>
        <Mic className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
        <p className="min-w-0 flex-1">
          This avatar has no reference recording yet, so it cannot tell your
          voice from anyone else in the room and is not learning it.
        </p>
        {onOpenVoiceSettings ? (
          <button
            type="button"
            onClick={onOpenVoiceSettings}
            className="shrink-0 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-neutral-900 transition hover:bg-white"
          >
            Record one
          </button>
        ) : null}
      </Shell>
    );
  }

  if (status.professional_state === 'awaiting_verification') {
    return (
      <Shell>
        <Sparkles className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
        <p className="min-w-0 flex-1">
          Enough speech for a studio-quality voice. It needs you to read one
          sentence aloud before training can start.
        </p>
        {onOpenVoiceSettings ? (
          <button
            type="button"
            onClick={onOpenVoiceSettings}
            className="shrink-0 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-neutral-900 transition hover:bg-white"
          >
            Verify
          </button>
        ) : null}
      </Shell>
    );
  }

  // Learning, and not there yet. Once the voice exists the avatar just speaks.
  if (status.accrual_enabled && !hasVoice) {
    const seconds = Math.min(Math.round(collected), Math.round(minimum));
    return (
      <Shell>
        <Mic className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
        <p className="min-w-0 flex-1">
          Learning your voice — {seconds}s of {Math.round(minimum)}s.
        </p>
      </Shell>
    );
  }

  return null;
}

/**
 * The shared frame, so every state above is the same quiet strip.
 *
 * @param {Object} parameters
 * @param {React.ReactNode} parameters.children The row's contents.
 * @returns {React.ReactElement}
 */
function Shell({ children }) {
  return (
    <div className="pointer-events-auto mx-auto flex w-full max-w-xl flex-wrap items-center gap-3 rounded-2xl bg-black/45 px-4 py-2 text-xs text-white/85 backdrop-blur-sm sm:flex-nowrap">
      {children}
    </div>
  );
}
