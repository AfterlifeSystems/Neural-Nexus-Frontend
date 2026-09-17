// src/hooks/useMessageActions.js
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useMedia } from '../context/MediaContext';
import useSpeech from './useSpeech';

/**
 * Copy, edit, retry, regenerate, feedback, and speak for a transcript.
 *
 * Owns the speech controls for one transcript surface. Message view and live
 * voice mode each call this hook, but `useSpeech` publishes speaking flags
 * through `avatarSpeechSession` so a Speak press in the transcript still
 * lights the portrait glow after the person opens voice mode. Starting one
 * utterance still stops another because both hooks drive the same audio
 * element.
 *
 * @param {Object} parameters
 * @param {string} [parameters.assistantId] The avatar whose voice to use.
 * @param {string} [parameters.avatarName] Named on the create-voice toast.
 * @param {boolean} [parameters.asAnonymousIdentity] Public chat: withhold the credential.
 * @param {boolean} [parameters.speechPlaybackEnabled] Whether speak-aloud is allowed for avatar replies.
 * @param {boolean} [parameters.userSpeechPlaybackEnabled] Whether the person's own messages may be spoken in their personal avatar's voice.
 * @param {string} [parameters.userSpeechAssistantId] The personal avatar, used for those utterances.
 * @param {boolean} [parameters.missingClonedVoice] No clone added to this model yet.
 * @param {boolean} [parameters.promptForMissingClonedVoice] False when a clone is not expected.
 */
export default function useMessageActions({
  assistantId,
  avatarName,
  asAnonymousIdentity = false,
  speechPlaybackEnabled = false,
  userSpeechPlaybackEnabled = false,
  userSpeechAssistantId = null,
  missingClonedVoice = false,
  promptForMissingClonedVoice = true,
} = {}) {
  const {
    activeConversation,
    resendFromUserMessage,
    regenerateAvatarReply,
    submitMessageFeedback,
    pendingSendCount,
  } = useMedia();
  const speech = useSpeech({
    asAnonymousIdentity,
    avatarName,
    conversationId: activeConversation,
    missingClonedVoice,
    promptForMissingClonedVoice,
  });
  const [loadingSpeechKey, setLoadingSpeechKey] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);
  const [editingKey, setEditingKey] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [feedbackKey, setFeedbackKey] = useState(null);
  const [feedbackDraft, setFeedbackDraft] = useState('');

  const toggleSpeech = async (
    messageKey,
    text,
    { alsoStopKeys = [], forUser = false } = {}
  ) => {
    const allowed = forUser
      ? userSpeechPlaybackEnabled
      : speechPlaybackEnabled;
    const speakAssistantId = forUser ? userSpeechAssistantId : assistantId;
    if (!allowed || !speakAssistantId) return;
    const speakingThis =
      speech.speakingKey === messageKey ||
      alsoStopKeys.includes(speech.speakingKey);
    if (speakingThis) {
      speech.stop();
      return;
    }
    setLoadingSpeechKey(messageKey);
    try {
      await speech.speak(speakAssistantId, text, { key: messageKey });
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
