// The sidebar "?" that opens Evan's help overlay.

import { CircleHelp } from 'lucide-react';
import { useLocation } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { useEvanAssist } from '../../context/EvanAssistContext';
import { shouldOfferEvanAssist } from '../../services/evanAssistSession';
import { resolveAssistantId } from '../utils';
import { AccountMenuItem } from '../AccountMenu';

const isEmbeddedFrame = () => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

/**
 * @param {{ variant?: 'icon' | 'row' }} props
 */
const EvanAssistLauncher = ({ variant = 'icon' }) => {
  const location = useLocation();
  const { activeAvatar } = useAuth();
  const { isOpen, toggle, evanId, evanName } = useEvanAssist();
  const offered = shouldOfferEvanAssist({
    inIframe: isEmbeddedFrame(),
    pathname: location.pathname,
    currentAssistantId: resolveAssistantId(activeAvatar) ?? null,
    evanAssistantId: evanId ?? null,
  });

  if (!offered) return null;

  const label = `Ask ${evanName}`;

  if (variant === 'row') {
    return (
      <AccountMenuItem
        icon={<CircleHelp className="w-4 h-4 shrink-0" />}
        label={label}
        isCurrent={isOpen}
        onClick={toggle}
      />
    );
  }

  return (
    <AccountMenuItem
      iconOnly
      icon={<CircleHelp className="w-4 h-4 shrink-0" />}
      label={label}
      ariaLabel={label}
      isCurrent={isOpen}
      onClick={toggle}
    />
  );
};

export default EvanAssistLauncher;
