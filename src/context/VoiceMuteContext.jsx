import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import {
  readVoiceMutePreferences,
  writeVoiceMutePreferences,
} from '../services/voiceMutePreference';

const VoiceMuteContext = createContext(null);

const INACTIVE_MUTE = {
  avatarMuted: false,
  micMuted: false,
  toggleAvatarMuted: () => {},
  toggleMicMuted: () => {},
  setAvatarMuted: () => {},
  setMicMuted: () => {},
};

export function VoiceMuteProvider({ children }) {
  const initial = readVoiceMutePreferences();
  const [avatarMuted, setAvatarMuted] = useState(initial.avatarMuted);
  const [micMuted, setMicMuted] = useState(initial.micMuted);

  useEffect(() => {
    writeVoiceMutePreferences({ avatarMuted, micMuted });
  }, [avatarMuted, micMuted]);

  const toggleAvatarMuted = useCallback(() => {
    setAvatarMuted((muted) => !muted);
  }, []);

  const toggleMicMuted = useCallback(() => {
    setMicMuted((muted) => !muted);
  }, []);

  return (
    <VoiceMuteContext.Provider
      value={{
        avatarMuted,
        micMuted,
        toggleAvatarMuted,
        toggleMicMuted,
        setAvatarMuted,
        setMicMuted,
      }}
    >
      {children}
    </VoiceMuteContext.Provider>
  );
}

export function useVoiceMute() {
  return useContext(VoiceMuteContext) ?? INACTIVE_MUTE;
}
