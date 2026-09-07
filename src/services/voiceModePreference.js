// Whether this browser prefers talking over typing.
//
// Voice mode is a way into the same conversation, not a different screen.
// Avatar settings and the inbox sit on that same workspace, so walking over
// to them must not drop the person back into the transcript when they return
// to Chat. Close is what leaves voice mode; the tabs are not.

const VOICE_MODE_PREFERRED_STORAGE_KEY = 'voice_mode_preferred';

/** Query that opens the Chat tab in voice mode. Stripped after ChatArea reads it. */
export const VOICE_MODE_QUERY = 'voice';

/**
 * Query that asks voice mode to put the live camera behind the avatar.
 *
 * This is how a person who has walked up to a geo-located avatar's place opens
 * that avatar: the camera shows the place they are standing in and the avatar
 * appears over it. Stripped after ChatArea reads it, like the voice query.
 */
export const CAMERA_BACKGROUND_QUERY = 'camera';

/**
 * @param {Storage} [storage]
 * @returns {boolean}
 */
export function readVoiceModePreference(storage = globalThis.localStorage) {
  try {
    return storage?.getItem(VOICE_MODE_PREFERRED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * @param {boolean} preferred
 * @param {Storage} [storage]
 */
export function writeVoiceModePreference(
  preferred,
  storage = globalThis.localStorage
) {
  try {
    if (preferred) {
      storage?.setItem(VOICE_MODE_PREFERRED_STORAGE_KEY, 'true');
    } else {
      storage?.removeItem(VOICE_MODE_PREFERRED_STORAGE_KEY);
    }
  } catch {
    // Private mode and a full quota both refuse writes; the preference then
    // lasts only as long as this screen stays mounted.
  }
}

/**
 * The stage covers the workspace, so it only belongs on the Chat tab.
 *
 * @param {boolean} preferred
 * @param {string} activeTab
 * @returns {boolean}
 */
export function voiceModeIsOpen(preferred, activeTab) {
  return Boolean(preferred) && activeTab === 'chat';
}

/**
 * @param {string} [assistantId]
 * @returns {string}
 */
export function voiceChatPath(assistantId, { cameraBackground = false } = {}) {
  if (!assistantId) return '/avatars';
  const camera = cameraBackground ? `&${CAMERA_BACKGROUND_QUERY}=1` : '';
  return `/chat/${encodeURIComponent(assistantId)}?${VOICE_MODE_QUERY}=1${camera}`;
}

/**
 * @param {string|URLSearchParams|null|undefined} search
 * @returns {boolean}
 */
export function searchRequestsVoiceMode(search) {
  const params =
    search instanceof URLSearchParams
      ? search
      : new URLSearchParams(search ?? '');
  return params.get(VOICE_MODE_QUERY) === '1';
}

/**
 * Whether the URL asks for the live camera behind the avatar.
 *
 * @param {string|URLSearchParams|null|undefined} search
 * @returns {boolean}
 */
export function searchRequestsCameraBackground(search) {
  const params =
    search instanceof URLSearchParams
      ? search
      : new URLSearchParams(search ?? '');
  return params.get(CAMERA_BACKGROUND_QUERY) === '1';
}

/**
 * Drop the voice-mode request and any settings/inbox tab so Chat + talking
 * is what the URL describes after the toast (or a bookmark) is followed.
 *
 * @param {string|URLSearchParams|null|undefined} search
 * @returns {URLSearchParams}
 */
export function consumeVoiceModeSearchParams(search) {
  const params = new URLSearchParams(
    search instanceof URLSearchParams ? search : search ?? ''
  );
  params.delete(VOICE_MODE_QUERY);
  params.delete(CAMERA_BACKGROUND_QUERY);
  params.delete('tab');
  params.delete('section');
  return params;
}

/**
 * Remember talking, then go to that avatar's voice chat.
 *
 * The toast host sits outside the router (see main.jsx), so this is a full
 * navigation rather than a hook. `?voice=1` makes the URL different from a
 * chat already open, so the assign is not a no-op, and ChatArea can open
 * voice mode even when localStorage refused the preference write.
 *
 * @param {string} [assistantId]
 * @param {Object} [options]
 * @param {Storage} [options.storage]
 * @param {Function} [options.assign]
 */
export function openVoiceChat(
  assistantId,
  {
    storage = globalThis.localStorage,
    assign = (path) => window.location.assign(path),
    cameraBackground = false,
  } = {}
) {
  writeVoiceModePreference(true, storage);
  assign(voiceChatPath(assistantId, { cameraBackground }));
}
