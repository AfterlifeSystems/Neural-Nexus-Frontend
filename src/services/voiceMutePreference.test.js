import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  readVoiceMutePreferences,
  writeVoiceMutePreferences,
} from './voiceMutePreference.js';

const memoryStorage = (initial = {}) => {
  const data = { ...initial };
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value);
    },
    data,
  };
};

test('mute preferences default off', () => {
  assert.deepEqual(readVoiceMutePreferences(memoryStorage()), {
    avatarMuted: false,
    micMuted: false,
  });
});

test('writing mute leaves the other voice-mode preferences in place', () => {
  const storage = memoryStorage({
    voice_mode_preferences: JSON.stringify({
      showCaptions: true,
      videoEnabled: false,
    }),
  });
  writeVoiceMutePreferences({ avatarMuted: true, micMuted: true }, storage);
  const stored = JSON.parse(storage.data.voice_mode_preferences);
  assert.equal(stored.showCaptions, true);
  assert.equal(stored.videoEnabled, false);
  assert.equal(stored.avatarMuted, true);
  assert.equal(stored.micMuted, true);
  assert.deepEqual(readVoiceMutePreferences(storage), {
    avatarMuted: true,
    micMuted: true,
  });
});
