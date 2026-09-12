// The missing-voice-model notice is only for a voice that has not yet been
// uploaded or trained — not for a clone ElevenLabs has blocked. Shown at most
// once per conversation while in voice mode. Speak is retried on every live
// reply, and without this the same sentence stacked on every turn.

const UNMINTED_CONVERSATION = '__new__';

const shownThisSession = new Set();

export function isUnmintedConversation(conversationId) {
  return !conversationId || conversationId === UNMINTED_CONVERSATION;
}

/**
 * Whether `conversationId` is the same conversation the notice was already
 * shown for. A thread that was still new (`__new__`) and the same thread
 * after the server minted an id are one conversation.
 *
 * @param {string|null|undefined} shownFor Conversation id the notice was shown for.
 * @param {string|null|undefined} conversationId The conversation now.
 * @returns {boolean}
 */
export function sameConversationAsVoiceNotReadyShown(shownFor, conversationId) {
  if (shownFor == null) return false;
  if (shownFor === conversationId) return true;
  return (
    shownFor === UNMINTED_CONVERSATION &&
    Boolean(conversationId) &&
    conversationId !== UNMINTED_CONVERSATION
  );
}

export function voiceNotReadyStorageKey(assistantId, conversationId) {
  const avatar = assistantId || 'avatar';
  if (isUnmintedConversation(conversationId)) {
    return `voice-not-ready-shown:${avatar}:new`;
  }
  return `voice-not-ready-shown:${avatar}:${conversationId}`;
}

export function avatarVoiceSettingsPath(assistantId) {
  return assistantId
    ? `/chat/${encodeURIComponent(assistantId)}?tab=settings&section=voice`
    : '/avatars';
}

export function voiceNotReadyToastTitle(avatarName) {
  return avatarName
    ? `${avatarName}: voice not yet added to this model`
    : 'Voice not yet added to this model';
}

function readableStorage(storage) {
  if (storage) return storage;
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

export function voiceNotReadyAlreadyShown(
  assistantId,
  conversationId,
  storage
) {
  const key = voiceNotReadyStorageKey(assistantId, conversationId);
  if (shownThisSession.has(key)) return true;
  // A thread that was still new when the notice appeared is the same
  // conversation after the server mints an id — do not prompt again.
  if (
    !isUnmintedConversation(conversationId) &&
    shownThisSession.has(
      voiceNotReadyStorageKey(assistantId, UNMINTED_CONVERSATION)
    )
  ) {
    return true;
  }
  if (isUnmintedConversation(conversationId)) return false;
  try {
    return readableStorage(storage)?.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function rememberVoiceNotReadyShown(
  assistantId,
  conversationId,
  storage
) {
  const key = voiceNotReadyStorageKey(assistantId, conversationId);
  shownThisSession.add(key);
  if (isUnmintedConversation(conversationId)) return;
  try {
    readableStorage(storage)?.setItem(key, '1');
  } catch {
    // Private mode can refuse storage; the in-memory set still covers this tab.
  }
}

export function resetVoiceNotReadyToastForTests() {
  shownThisSession.clear();
}
