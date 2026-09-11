// Avatar speaker and microphone mute, kept with the other voice-mode
// preferences so a reload does not forget them. The sidebar owns these
// toggles; live voice mode only reads them.

const PREFERENCES_KEY = 'voice_mode_preferences';

const readStore = (storage) => {
  try {
    return JSON.parse(storage?.getItem(PREFERENCES_KEY) ?? '{}') || {};
  } catch {
    return {};
  }
};

/**
 * @param {Storage} [storage]
 * @returns {{avatarMuted: boolean, micMuted: boolean}}
 */
export function readVoiceMutePreferences(storage = globalThis.localStorage) {
  const preferences = readStore(storage);
  return {
    avatarMuted: Boolean(preferences.avatarMuted),
    micMuted: Boolean(preferences.micMuted),
  };
}

/**
 * @param {{avatarMuted?: boolean, micMuted?: boolean}} next
 * @param {Storage} [storage]
 */
export function writeVoiceMutePreferences(
  next,
  storage = globalThis.localStorage
) {
  try {
    const preferences = readStore(storage);
    storage?.setItem(
      PREFERENCES_KEY,
      JSON.stringify({
        ...preferences,
        avatarMuted: Boolean(next.avatarMuted),
        micMuted: Boolean(next.micMuted),
      })
    );
  } catch {
    // Private mode and a full quota both refuse writes; the choice then
    // lasts only as long as this page stays mounted.
  }
}
