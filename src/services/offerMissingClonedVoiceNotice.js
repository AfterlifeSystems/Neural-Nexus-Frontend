// Show the missing-clone notice when this avatar has no cloned voice yet.
//
// Callers supply the voice-status read and the toast so this module stays
// free of JSX. Fail open: a status read that throws leaves the conversation
// quiet.

import { avatarHasClonedVoice } from './avatarHasClonedVoice.js';
import { shouldPromptForMissingClonedVoice } from './missingClonedVoicePrompt.js';

/**
 * @param {Object} options
 * @param {string|null|undefined} options.assistantId
 * @param {string|null|undefined} [options.avatarName]
 * @param {string|null|undefined} options.conversationId Skip until the thread
 *   id is known (`null` while a conversation is still loading is not a new chat).
 * @param {Object|null|undefined} [options.avatar]
 * @param {Object|null|undefined} [options.user]
 * @param {boolean} [options.readerOwnsAvatar]
 * @param {boolean} [options.readerIsAnonymous]
 * @param {() => boolean} [options.isCancelled]
 * @param {(assistantId: string) => Promise<Object>} options.readAvatarVoice
 * @param {(parameters: Object) => void} options.showNotice
 */
export async function offerMissingClonedVoiceNotice({
  assistantId,
  avatarName,
  conversationId,
  avatar,
  user,
  readerOwnsAvatar = true,
  readerIsAnonymous = false,
  isCancelled = () => false,
  readAvatarVoice,
  showNotice,
} = {}) {
  if (!assistantId || !conversationId) return;
  if (!readerOwnsAvatar || readerIsAnonymous) return;
  if (!shouldPromptForMissingClonedVoice({ avatar, user })) return;
  if (typeof readAvatarVoice !== 'function' || typeof showNotice !== 'function') {
    return;
  }
  try {
    const status = await readAvatarVoice(assistantId);
    if (isCancelled()) return;
    if (avatarHasClonedVoice(status)) return;
    showNotice({
      assistantId,
      avatarName,
      collectedSeconds: status?.collected_seconds ?? 0,
      conversationId,
      prompt: true,
    });
  } catch {
    // Leave quiet if the voice status cannot be read.
  }
}
