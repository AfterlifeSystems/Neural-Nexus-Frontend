// The missing-voice-model notice is only for a voice that has not yet been
// uploaded or trained — not for a clone ElevenLabs has blocked. Shown at most
// once per avatar per tab session. Speak is retried from the transcript and
// from voice mode, each with its own hook, and every retry is another
// refusal — without this the same sentence stacked on every press.

const shownThisSession = new Set();

export function voiceNotReadyStorageKey(assistantId) {
  return `voice-not-ready-shown:${assistantId || 'avatar'}`;
}

export function avatarVoiceSettingsPath(assistantId) {
  return assistantId
    ? `/chat/${encodeURIComponent(assistantId)}?tab=settings&section=voice`
    : '/avatars';
}

export function voiceNotReadyToastTitle(avatarName) {
  return `${avatarName ?? 'This avatar'} does not have a voice model`;
}

function readableStorage(storage) {
  if (storage) return storage;
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

export function voiceNotReadyAlreadyShown(assistantId, storage) {
  const key = voiceNotReadyStorageKey(assistantId);
  if (shownThisSession.has(key)) return true;
  try {
    return readableStorage(storage)?.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function rememberVoiceNotReadyShown(assistantId, storage) {
  const key = voiceNotReadyStorageKey(assistantId);
  shownThisSession.add(key);
  try {
    readableStorage(storage)?.setItem(key, '1');
  } catch {
    // Private mode can refuse storage; the in-memory set still covers this tab.
  }
}

export function resetVoiceNotReadyToastForTests() {
  shownThisSession.clear();
}
