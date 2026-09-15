// The missing-voice-model notice is only for a voice that has not yet been
// uploaded or trained — not for a clone ElevenLabs has blocked. Shown at most
// once per conversation per avatar. Speak is retried on every live reply, and
// without this the same sentence stacked on every turn. A new conversation
// with the same avatar may show the notice again. An unminted thread
// (`__new__`) and that same thread after the server mints an id are one
// conversation; a later `__new__` is not.

const UNMINTED_CONVERSATION = '__new__';

const shownThisSession = new Set();

export function isUnmintedConversation(conversationId) {
  return conversationId === UNMINTED_CONVERSATION;
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
  if (shownFor == null || conversationId == null) return false;
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

/**
 * One toast on screen per avatar, so a mint or a conversation switch replaces
 * rather than stacking a second notice.
 *
 * @param {string|null|undefined} assistantId
 * @returns {string}
 */
export function voiceNotReadyToastId(assistantId) {
  return `voice-not-ready-shown:${assistantId || 'avatar'}`;
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

function persistMintedVoiceNotReadyShown(assistantId, conversationId, storage) {
  if (!assistantId || isUnmintedConversation(conversationId) || !conversationId) {
    return;
  }
  try {
    readableStorage(storage)?.setItem(
      voiceNotReadyStorageKey(assistantId, conversationId),
      '1'
    );
  } catch {
    // Private mode can refuse storage; the in-memory set still covers this tab.
  }
}

/**
 * Move the unminted showing onto the minted thread id so the same conversation
 * does not prompt again, and a later new conversation can.
 *
 * @param {string} assistantId
 * @param {string} conversationId Minted thread id.
 * @param {Storage} [storage]
 * @returns {boolean} Whether an unminted showing was bound to this thread.
 */
function bindUnmintedVoiceNotReadyShown(assistantId, conversationId, storage) {
  if (!assistantId || isUnmintedConversation(conversationId) || !conversationId) {
    return false;
  }
  const unmintedKey = voiceNotReadyStorageKey(
    assistantId,
    UNMINTED_CONVERSATION
  );
  if (!shownThisSession.has(unmintedKey)) return false;
  shownThisSession.delete(unmintedKey);
  const mintedKey = voiceNotReadyStorageKey(assistantId, conversationId);
  shownThisSession.add(mintedKey);
  persistMintedVoiceNotReadyShown(assistantId, conversationId, storage);
  return true;
}

export function voiceNotReadyAlreadyShown(
  assistantId,
  conversationId,
  storage
) {
  if (!assistantId || !conversationId) return false;
  const key = voiceNotReadyStorageKey(assistantId, conversationId);
  if (shownThisSession.has(key)) return true;
  if (bindUnmintedVoiceNotReadyShown(assistantId, conversationId, storage)) {
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
  if (!assistantId || !conversationId) return;
  const key = voiceNotReadyStorageKey(assistantId, conversationId);
  shownThisSession.add(key);
  persistMintedVoiceNotReadyShown(assistantId, conversationId, storage);
}

/**
 * Forget that this avatar's unminted new conversation already showed the
 * notice. "New conversation" reuses `__new__`, so without this a second new
 * chat before the first is minted would never prompt again. Minted threads
 * keep their own mark.
 *
 * @param {string|null|undefined} assistantId
 */
export function forgetUnmintedVoiceNotReadyShown(assistantId) {
  if (!assistantId) return;
  shownThisSession.delete(
    voiceNotReadyStorageKey(assistantId, UNMINTED_CONVERSATION)
  );
}

export function resetVoiceNotReadyToastForTests() {
  shownThisSession.clear();
}
