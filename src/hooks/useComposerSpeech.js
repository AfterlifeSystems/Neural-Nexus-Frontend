// src/hooks/useComposerSpeech.js
import { useCallback, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isSharedAvatarChatPath } from '../components/utils';
import { canUseAvatarSpeechPlayback } from '../services/avatarSpeechPlayback';
import { COMPOSER_DRAFT_SPEAK_KEY } from '../components/composerSpeech';
import usePersonalAvatar from './usePersonalAvatar';
import useSpeech from './useSpeech';

/**
 * Play the composer draft in the person's own voice without sending a turn.
 *
 * Text-to-speech only. Speech-to-text into the chat composer is deliberately
 * not offered here; talking to the avatar belongs to voice mode.
 *
 * @param {Object} parameters
 * @param {string} parameters.text The current composer value.
 */
export default function useComposerSpeech({ text } = {}) {
  const { user } = useAuth();
  const location = useLocation();
  const readerIsAnonymous = isSharedAvatarChatPath(location.pathname);
  const { personalAvatar, personalAssistantId } = usePersonalAvatar();
  const canPlayDraft = Boolean(
    !readerIsAnonymous &&
      personalAssistantId &&
      canUseAvatarSpeechPlayback(personalAvatar, user, {
        pathname: location.pathname,
      })
  );
  const speech = useSpeech({
    asAnonymousIdentity: readerIsAnonymous,
    avatarName: personalAvatar?.name,
  });
  const [isPlayLoading, setIsPlayLoading] = useState(false);
  const textRef = useRef(text);
  textRef.current = text;

  const playText = useCallback(
    async (words) => {
      const utterance = String(words ?? '').trim();
      if (!utterance || !canPlayDraft || !personalAssistantId) return;
      setIsPlayLoading(true);
      try {
        await speech.speak(personalAssistantId, utterance, {
          key: COMPOSER_DRAFT_SPEAK_KEY,
        });
      } finally {
        setIsPlayLoading(false);
      }
    },
    [canPlayDraft, personalAssistantId, speech]
  );

  const togglePlayDraft = useCallback(() => {
    if (speech.speakingKey === COMPOSER_DRAFT_SPEAK_KEY) {
      speech.stop();
      return;
    }
    const utterance = String(textRef.current ?? '').trim();
    if (!utterance) {
      toast.error('Type something first.');
      return;
    }
    if (!canPlayDraft) {
      toast.error('Your voice is not available to play yet.');
      return;
    }
    playText(utterance);
  }, [canPlayDraft, playText, speech]);

  return {
    canPlayDraft,
    isPlayLoading,
    isPlayingDraft: speech.speakingKey === COMPOSER_DRAFT_SPEAK_KEY,
    togglePlayDraft,
  };
}
