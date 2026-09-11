import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';

import { AccountMenuItem } from './AccountMenu';
import { useVoiceMute } from '../context/VoiceMuteContext';

/**
 * Mute the avatar and mute the microphone.
 *
 * These live on the sidebar rail (and the open panel) so they stay put when
 * the voice-mode message bar folds. The rail is already a vertical column,
 * which is the layout a phone needs.
 *
 * @param {{ variant?: 'icons' | 'rows' }} props
 */
const SidebarVoiceMuteControls = ({ variant = 'icons' }) => {
  const { avatarMuted, micMuted, toggleAvatarMuted, toggleMicMuted } =
    useVoiceMute();
  const iconOnly = variant !== 'rows';
  const avatarLabel = avatarMuted ? 'Unmute the avatar' : 'Mute the avatar';
  const micLabel = micMuted
    ? 'Unmute your microphone'
    : 'Mute your microphone';

  return (
    <div
      data-voice-mute-bar
      className={iconOnly ? 'flex flex-col items-center gap-0.5' : 'space-y-1'}
    >
      <AccountMenuItem
        iconOnly={iconOnly}
        icon={
          avatarMuted ? (
            <VolumeX className="w-4 h-4 shrink-0" />
          ) : (
            <Volume2 className="w-4 h-4 shrink-0" />
          )
        }
        label={avatarLabel}
        isPressed={!avatarMuted}
        onClick={toggleAvatarMuted}
      />
      <AccountMenuItem
        iconOnly={iconOnly}
        icon={
          micMuted ? (
            <MicOff className="w-4 h-4 shrink-0" />
          ) : (
            <Mic className="w-4 h-4 shrink-0" />
          )
        }
        label={micLabel}
        isPressed={!micMuted}
        onClick={toggleMicMuted}
      />
    </div>
  );
};

export default SidebarVoiceMuteControls;
