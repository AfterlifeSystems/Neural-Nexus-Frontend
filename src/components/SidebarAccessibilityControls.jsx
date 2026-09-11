import { Accessibility } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { AccountMenuItem } from './AccountMenu';
import { useAuth } from '../context/AuthContext';
import useSceneNarration from '../hooks/useSceneNarration';
import { openCollapsedSidebar } from './sharePreviewSlots';
import { resolveAssistantId } from './utils';

/**
 * The accessibility control in the sidebar: describe my surroundings, or stop.
 *
 * One press starts the mode that points the phone's rear camera at the world
 * and reads out what is in front of the person, every few seconds, for as long
 * as it is on. The press answers out loud, because the person this is built
 * for cannot see that anything happened — and because a browser that will not
 * speak until a gesture has happened is unlocked by that same answer.
 *
 * It sits beside the share controls rather than inside them on purpose. Sharing
 * a webcam is something a person does FOR the avatar; this is something the
 * avatar does FOR the person, it is reached from three other places (any
 * conversation, the help overlay, the Accessibility page), and burying it in a
 * sharing menu is how an accessibility feature becomes one nobody finds.
 *
 * @param {{ variant?: 'icons' | 'rows' }} props
 */
const SidebarAccessibilityControls = ({ variant = 'icons' }) => {
  const navigate = useNavigate();
  const { activeAvatar } = useAuth();
  const { sceneNarrationOn, setSceneNarrationOn } = useSceneNarration();

  const label = sceneNarrationOn
    ? 'Stop describing my surroundings'
    : 'Describe my surroundings';

  const flip = () =>
    setSceneNarrationOn(!sceneNarrationOn, {
      avatarName: activeAvatar?.name,
      // Said in the avatar's own voice, like every description that follows.
      assistantId: resolveAssistantId(activeAvatar),
    });

  if (variant === 'rows') {
    return (
      <div className="space-y-1">
        <AccountMenuItem
          icon={<Accessibility className="w-4 h-4 shrink-0" />}
          label={label}
          isPressed={sceneNarrationOn}
          onClick={flip}
        />
        <p className="px-3 pt-1 text-[11px] text-white/50" aria-live="polite">
          {sceneNarrationOn
            ? `${activeAvatar?.name ?? 'Your avatar'} is describing what your camera sees, out loud.`
            : 'Point your camera at what is in front of you and have it read to you.'}
        </p>
        <AccountMenuItem
          icon={<Accessibility className="w-4 h-4 shrink-0 opacity-0" />}
          label="Accessibility settings"
          onClick={() => navigate('/accessibility')}
        />
      </div>
    );
  }

  return (
    <AccountMenuItem
      iconOnly
      icon={<Accessibility className="w-4 h-4 shrink-0" />}
      label={label}
      isPressed={sceneNarrationOn}
      onClick={(event) => {
        const wasOff = !sceneNarrationOn;
        flip();
        // Turning it on reveals the panel, so the status line and the way to
        // the Accessibility page are in front of whoever pressed it.
        if (wasOff) openCollapsedSidebar(event.currentTarget);
      }}
    />
  );
};

export default SidebarAccessibilityControls;
