// Offer the missing-clone notice from the chat workspace itself.
//
// Speak and live voice mode also raise it, but those surfaces are not mounted
// on an ordinary messages conversation. Starting a new chat must still prompt
// once when this model has no clone yet.

import { useEffect } from 'react';
import { showVoiceNotReadyToast } from '../components/showVoiceNotReadyToast';
import { getAvatarVoice } from '../services/avatarService';
import { offerMissingClonedVoiceNotice as offerNotice } from '../services/offerMissingClonedVoiceNotice';

/**
 * Show the missing-clone notice when this avatar has no cloned voice yet.
 *
 * @param {Object} options
 * @param {string|null|undefined} options.assistantId
 * @param {string|null|undefined} [options.avatarName]
 * @param {string|null|undefined} options.conversationId
 * @param {Object|null|undefined} [options.avatar]
 * @param {Object|null|undefined} [options.user]
 * @param {boolean} [options.readerOwnsAvatar]
 * @param {boolean} [options.readerIsAnonymous]
 * @param {() => boolean} [options.isCancelled]
 */
export async function offerMissingClonedVoiceNotice(options = {}) {
  return offerNotice({
    ...options,
    readAvatarVoice: options.readAvatarVoice ?? getAvatarVoice,
    showNotice: options.showNotice ?? showVoiceNotReadyToast,
  });
}

/**
 * Offer the missing-clone notice when the open conversation is known.
 *
 * @param {Object} options
 * @param {string|null|undefined} options.assistantId
 * @param {string|null|undefined} [options.avatarName]
 * @param {string|null|undefined} options.conversationId
 * @param {Object|null|undefined} [options.avatar]
 * @param {Object|null|undefined} [options.user]
 * @param {boolean} [options.readerOwnsAvatar]
 * @param {boolean} [options.readerIsAnonymous]
 * @param {boolean} [options.enabled]
 */
export default function useMissingClonedVoiceNotice({
  assistantId,
  avatarName,
  conversationId,
  avatar,
  user,
  readerOwnsAvatar = true,
  readerIsAnonymous = false,
  enabled = true,
} = {}) {
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    void offerMissingClonedVoiceNotice({
      assistantId,
      avatarName,
      conversationId,
      avatar,
      user,
      readerOwnsAvatar,
      readerIsAnonymous,
      isCancelled: () => cancelled,
    });
    return () => {
      cancelled = true;
    };
  }, [
    assistantId,
    avatarName,
    avatar,
    conversationId,
    enabled,
    readerIsAnonymous,
    readerOwnsAvatar,
    user,
  ]);
}
