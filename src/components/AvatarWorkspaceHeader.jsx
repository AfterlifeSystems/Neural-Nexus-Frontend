// src/components/AvatarWorkspaceHeader.jsx
//
// The identity block on an avatar's screen. The portrait and name sit
// centered above Chat, Inbox (personal avatar), Avatar Settings, and Avatar
// Selection so the face is the header, not a leftover beside the labels.
// Clicking the portrait opens Chat. Tab labels share the row and wrap
// rather than sliding sideways.

import React from 'react';
import { User } from 'lucide-react';
import { isValidImageUrl } from './utils';
import ProfileBubbleImage from './ProfileBubbleImage';
import { workspaceHeaderPortraitTab } from './personalAvatarWorkspace';

const tabButtonClass = (isActive) =>
  `voice-workspace-tab relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-center text-[11px] leading-tight sm:flex-row sm:gap-1.5 sm:px-2 sm:py-2 sm:text-sm ${
    isActive
      ? 'voice-workspace-tab-active border-b-2 border-amber-400 font-semibold text-neutral-200'
      : 'border-b-2 border-transparent text-white/60 hover:text-neutral-200'
  }`;

/**
 * @param {Object} parameters
 * @param {string} parameters.tab
 * @param {string} parameters.activeTab
 * @param {Function} parameters.onTabChange
 * @param {string} [parameters.ariaLabel]
 * @param {React.ReactNode} parameters.children
 */
const WorkspaceTab = ({ tab, activeTab, onTabChange, ariaLabel, children }) => {
  const isActive = activeTab === tab;
  return (
    <button
      type="button"
      data-workspace-tab={tab}
      aria-current={isActive ? 'page' : undefined}
      aria-label={ariaLabel}
      className={tabButtonClass(isActive)}
      onClick={() => onTabChange(tab)}
    >
      {children}
    </button>
  );
};

/**
 * @param {Object} parameters
 * @param {string} [parameters.avatarName]
 * @param {string|null} [parameters.headerFace] Portrait or emotion still.
 * @param {string|null} [parameters.assistantId] Profile-bubble crop from settings.
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
  assistantId = null,
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
      data-workspace-header
      className={`flex flex-col shrink-0 border-b border-white/10 ${className}`}
    >
      <div className="relative flex items-center justify-center gap-2.5 px-3 pt-2 pb-1.5 sm:gap-3 sm:pt-2.5 sm:pb-2">
        <button
          type="button"
          data-workspace-portrait
          title={avatarName ? `Open chat with ${avatarName}` : 'Open chat'}
          aria-label={avatarName ? `Open chat with ${avatarName}` : 'Open chat'}
          className="profile-bubble-disc relative w-11 h-11 sm:w-14 sm:h-14 shrink-0 rounded-full bg-black/50 border border-white/10 overflow-hidden hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20"
          onClick={() => onTabChange(workspaceHeaderPortraitTab())}
        >
          {headerFace && isValidImageUrl(headerFace) ? (
            <ProfileBubbleImage
              src={headerFace}
              alt=""
              assistantId={assistantId}
              className="h-full w-full"
              onError={onPortraitError}
            />
          ) : (
            <User className="absolute inset-0 m-auto w-5 h-5 sm:w-6 sm:h-6 text-white/40" />
          )}
        </button>
        {avatarName ? (
          <p className="max-w-[12rem] sm:max-w-xs text-sm sm:text-base font-semibold text-neutral-200 truncate">
            {avatarName}
          </p>
        ) : null}
        {trailing ? (
          <div className="absolute right-0 top-1/2 -translate-y-1/2">
            {trailing}
          </div>
        ) : null}
      </div>
      <nav
        aria-label="Avatar workspace"
        className="flex min-w-0 w-full items-stretch"
      >
        <WorkspaceTab
          tab="chat"
          activeTab={activeTab}
          onTabChange={onTabChange}
          ariaLabel={avatarName ? `Chat with ${avatarName}` : 'Chat'}
        >
          Chat
        </WorkspaceTab>
        {isPersonalAvatar && (
          <WorkspaceTab
            tab="inbox"
            activeTab={activeTab}
            onTabChange={onTabChange}
            ariaLabel={
              inboxCount > 0 ? `Inbox, ${inboxCount} items waiting` : 'Inbox'
            }
          >
            Inbox
            {inboxCount > 0 && (
              <span
                aria-hidden
                className="min-w-4 h-4 px-1 rounded-full bg-amber-400 text-neutral-900 text-[10px] font-semibold flex items-center justify-center sm:min-w-[1.25rem] sm:h-5 sm:px-1.5 sm:text-xs"
              >
                {inboxCount > 99 ? '99+' : inboxCount}
              </span>
            )}
          </WorkspaceTab>
        )}
        {canOpenAvatarSettings && (
          <WorkspaceTab
            tab="avatar-settings"
            activeTab={activeTab}
            onTabChange={onTabChange}
          >
            <span>
              Avatar
              <br className="sm:hidden" />
              <span className="hidden sm:inline"> </span>
              Settings
            </span>
          </WorkspaceTab>
        )}
        <WorkspaceTab
          tab="avatar-selection"
          activeTab={activeTab}
          onTabChange={onTabChange}
        >
          <span>
            Avatar
            <br className="sm:hidden" />
            <span className="hidden sm:inline"> </span>
            Selection
          </span>
        </WorkspaceTab>
      </nav>
    </div>
  );
};

export default AvatarWorkspaceHeader;
