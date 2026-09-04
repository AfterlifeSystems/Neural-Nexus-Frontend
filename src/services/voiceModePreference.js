// Whether this browser prefers talking over typing.
//
// Voice mode is a way into the same conversation, not a different screen.
// Avatar settings and the inbox sit on that same workspace, so walking over
// to them must not drop the person back into the transcript when they return
// to Chat. Close is what leaves voice mode; the tabs are not.

const VOICE_MODE_PREFERRED_STORAGE_KEY = 'voice_mode_preferred';

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
