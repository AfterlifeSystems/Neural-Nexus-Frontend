// src/components/AvatarWorkspaceHeader.jsx
//
// The tab strip on an avatar's screen: Chat, Inbox (personal avatar), Settings,
// and Avatar Selection. Chat, settings and inbox already share this row;
// voice mode uses the same strip so those places stay one click away while
// talking, instead of a name-and-close bar that hid them.

import React from 'react';
import { User } from 'lucide-react';
import { isValidImageUrl } from './utils';

const tabButtonClass = (isActive) =>
  `voice-workspace-tab px-3 sm:px-4 py-2 whitespace-nowrap text-sm sm:text-base text-neutral-200 ${
    isActive
      ? 'voice-workspace-tab-active border-b-2 border-amber-400 font-semibold'
      : ''
  }`;

/**
 * @param {Object} parameters
 * @param {string} [parameters.avatarName]
 * @param {string|null} [parameters.headerFace] Portrait or emotion still.
 * @param {Function} [parameters.onPortraitError]
 * @param {'chat'|'inbox'|'avatar-settings'|'avatar-selection'} parameters.activeTab
 * @param {boolean} parameters.isPersonalAvatar
 * @param {boolean} parameters.canOpenAvatarSettings
 * @param {number} [parameters.inboxCount]
 * @param {Function} parameters.onTabChange
 * @param {React.ReactNode} [parameters.trailing] Close control, status, etc.
 * @param {string} [parameters.className]
 */
const AvatarWorkspaceHeader = ({
  avatarName,
  headerFace,
  onPortraitError,
  activeTab,
  isPersonalAvatar,
  canOpenAvatarSettings,
  inboxCount = 0,
  onTabChange,
  trailing = null,
  className = '',
}) => {
  return (
    <div
      className={`flex items-center shrink-0 border-b border-white/10 gap-1 sm:gap-4 ${className}`}
    >
      <div className="flex items-center min-w-0 flex-1 gap-1 sm:gap-4 sm:justify-center overflow-x-auto overflow-y-hidden scrollbar-none">
        <div className="w-9 h-9 shrink-0 rounded-full bg-black/50 border border-white/10 flex items-center justify-center overflow-hidden">
          {headerFace && isValidImageUrl(headerFace) ? (
            <img
              src={headerFace}
              alt={avatarName ?? 'Avatar'}
              className="w-full h-full object-cover"
              onError={onPortraitError}
            />
          ) : (
            <User className="w-5 h-5 text-white/40" />
          )}
        </div>
        <button
          type="button"
          className={tabButtonClass(activeTab === 'chat')}
          onClick={() => onTabChange('chat')}
        >
          <span className="hidden sm:inline">
            {avatarName ? `A.I. ${avatarName} ` : 'A.I. '}
          </span>
          Chat
        </button>
        {isPersonalAvatar && (
          <button
            type="button"
            className={`${tabButtonClass(activeTab === 'inbox')} inline-flex items-center gap-2`}
            onClick={() => onTabChange('inbox')}
          >
            Inbox
            {inboxCount > 0 && (
              <span
                aria-label={`${inboxCount} items waiting`}
                className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-amber-400 text-neutral-900 text-xs font-semibold flex items-center justify-center"
              >
                {inboxCount > 99 ? '99+' : inboxCount}
              </span>
            )}
          </button>
        )}
        {canOpenAvatarSettings && (
          <button
            type="button"
            className={tabButtonClass(activeTab === 'avatar-settings')}
            onClick={() => onTabChange('avatar-settings')}
          >
            <span className="hidden sm:inline">Avatar </span>Settings
          </button>
        )}
        <button
          type="button"
          className={tabButtonClass(activeTab === 'avatar-selection')}
          onClick={() => onTabChange('avatar-selection')}
        >
          <span className="hidden sm:inline">Avatar Selection</span>
          <span className="sm:hidden">Avatars</span>
        </button>
      </div>
      {trailing}
    </div>
  );
};

export default AvatarWorkspaceHeader;
