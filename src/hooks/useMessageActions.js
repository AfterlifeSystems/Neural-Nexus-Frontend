// src/hooks/useMessageActions.js
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useMedia } from '../context/MediaContext';
import { showVoiceNotReadyToast } from '../components/showVoiceNotReadyToast';
import useSpeech from './useSpeech';

/**
 * Copy, edit, retry, regenerate, feedback, and speak for a transcript.
 *
 * Owns the one speech session those controls share, so starting one utterance
 * stops another. Callers that also speak a live reply (voice mode) should use
 * this same `speech` object rather than opening a second session.
 *
 * @param {Object} parameters
 * @param {string} [parameters.assistantId] The avatar whose voice to use.
 * @param {string} [parameters.avatarName] Shown on the voice-not-ready toast.
 * @param {boolean} [parameters.asAnonymousIdentity] Public chat: withhold the credential.
 * @param {boolean} [parameters.speechPlaybackEnabled] Whether speak-aloud is allowed.
 */
export default function useMessageActions({
  assistantId,
  avatarName,
  asAnonymousIdentity = false,
  speechPlaybackEnabled = false,
} = {}) {
  const {
    resendFromUserMessage,
    regenerateAvatarReply,
    submitMessageFeedback,
    pendingSendCount,
  } = useMedia();
  const speech = useSpeech({ asAnonymousIdentity });
  const [loadingSpeechKey, setLoadingSpeechKey] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);
  const [editingKey, setEditingKey] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [feedbackKey, setFeedbackKey] = useState(null);
  const [feedbackDraft, setFeedbackDraft] = useState('');

  useEffect(() => {
    if (speech.notReady) {
      showVoiceNotReadyToast({
        assistantId,
        avatarName,
        collectedSeconds: speech.notReady.collectedSeconds,
      });
    }
  }, [speech.notReady, avatarName, assistantId]);

  const toggleSpeech = async (messageKey, text, { alsoStopKeys = [] } = {}) => {
    if (!speechPlaybackEnabled) return;
    const speakingThis =
      speech.speakingKey === messageKey ||
      alsoStopKeys.includes(speech.speakingKey);
    if (speakingThis) {
      speech.stop();
      return;
    }
    setLoadingSpeechKey(messageKey);
    try {
      await speech.speak(assistantId, text, { key: messageKey });
    } finally {
      setLoadingSpeechKey(null);
    }
  };

  const copyMessage = async (messageKey, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(messageKey);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      toast.error('Could not copy.');
    }
  };

  return {
    speech,
    pendingSendCount,
    loadingSpeechKey,
    copiedKey,
    editingKey,
    setEditingKey,
    editDraft,
    setEditDraft,
    feedbackKey,
    setFeedbackKey,
    feedbackDraft,
    setFeedbackDraft,
    toggleSpeech,
    copyMessage,
    resendFromUserMessage,
    regenerateAvatarReply,
    submitMessageFeedback,
  };
}
