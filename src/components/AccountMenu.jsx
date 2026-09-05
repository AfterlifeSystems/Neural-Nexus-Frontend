// src/components/AccountMenu.jsx
//
// The account actions, defined once. They appear in two places — the sidebar
// and the User Settings menu on the avatar screen — and the only difference
// between them is whether the list opens with a way back to the avatar
// gallery: the sidebar does, the User Settings menu (already on an avatar's
// screen) does not. Both offer the settings of the avatar that depicts you,
// and everything else is shared here so the two cannot drift into offering
// different things.

import React from 'react';
import {
  CreditCard,
  Inbox,
  LogOut,
  Settings,
  UserCog,
  Users,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { getPersonalAvatar } from '../services/avatarService';
import useInboxCount from '../hooks/useInboxCount';

const MENU_TONE = {
  danger: 'text-red-400 hover:bg-red-900/40 hover:text-neutral-100',
  current: 'bg-white/15 text-neutral-200',
  rest: 'text-white/70 hover:bg-white/10 hover:text-neutral-100',
};

/**
 * One row of the account menu, or one icon on the collapsed rail.
 */
export const AccountMenuItem = ({
  icon,
  label,
  ariaLabel,
  onClick,
  isCurrent,
  isDanger,
  iconOnly = false,
  badgeCount = 0,
}) => {
  const tone = isDanger
    ? MENU_TONE.danger
    : isCurrent
      ? MENU_TONE.current
      : MENU_TONE.rest;
  const accessibleName =
    ariaLabel ?? (typeof label === 'string' ? label : undefined);

  return (
    <button
      onClick={(clickEvent) => {
        clickEvent.stopPropagation();
        onClick?.(clickEvent);
      }}
      aria-current={isCurrent ? 'page' : undefined}
      aria-label={iconOnly ? accessibleName : undefined}
      title={iconOnly ? accessibleName : undefined}
      className={
        iconOnly
          ? `relative p-1.5 rounded-lg transition-colors flex items-center justify-center ${tone}`
          : `w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${tone}`
      }
    >
      {icon}
      {!iconOnly && label}
      {iconOnly && badgeCount > 0 && (
        <span
          data-rail-badge
          aria-label={`${badgeCount} items waiting`}
          className="absolute -top-0.5 -right-0.5 min-w-[0.875rem] h-3.5 px-0.5 rounded-full bg-amber-400 text-neutral-900 text-[9px] font-semibold flex items-center justify-center"
        >
          {badgeCount > 9 ? '9+' : badgeCount}
        </span>
      )}
    </button>
  );
};

/**
 * Find the avatar that depicts the signed-in user.
 *
 * Preferring the list already in memory keeps the common case free of a round
 * trip; the API is asked only when the list has not been loaded or carries no
 * flagged avatar (a public entry has its metadata stripped, so the flag can be
 * missing from a list that nonetheless contains the avatar).
 *
 * @param {Array} userAvatars Avatars already held in context.
 * @returns {Promise<string|null>} The personal avatar's assistant_id.
 */
export async function resolvePersonalAvatarId(userAvatars) {
  const flaggedAvatar = (userAvatars ?? []).find(
    (avatar) => avatar.metadata?.is_personal_avatar_of_creator
  );
  if (flaggedAvatar) {
    return flaggedAvatar.assistant_id ?? flaggedAvatar.avatar_id ?? null;
  }
  try {
    const personalAvatarResponse = await getPersonalAvatar();
    return personalAvatarResponse?.personal_avatar?.assistant_id ?? null;
  } catch (personalAvatarError) {
    console.error(
      'Could not resolve the personal avatar:',
      personalAvatarError
    );
    return null;
  }
}

/**
 * Open a tab on the workspace of the avatar that depicts the signed-in user.
 *
 * Inbox and settings belong to that avatar, so the sidebar entries must
 * select it first — the same header as opening its chat — rather than a
 * standalone page with no face or name.
 *
 * @param {Function} [onNavigate] Called before navigating, to dismiss the
 *   panel or menu the control is rendered inside.
 * @returns {Function} An async handler `(tab)` — `inbox`, `settings`, or chat.
 */
export function usePersonalAvatarWorkspaceNavigation(onNavigate) {
  const navigate = useNavigate();
  const { userAvatars } = useAuth();

  return async (tab = 'chat') => {
    const personalAvatarId = await resolvePersonalAvatarId(userAvatars);
    onNavigate?.();
    if (!personalAvatarId) {
      // Saying nothing would look like a dead button.
      const { toast } = await import('react-hot-toast');
      toast.error('You do not have a personal avatar yet.');
      return;
    }
    const encoded = encodeURIComponent(personalAvatarId);
    if (tab === 'settings') {
      navigate(`/chat/${encoded}?tab=settings`);
      return;
    }
    if (tab === 'inbox') {
      navigate(`/chat/${encoded}?tab=inbox`);
      return;
    }
    navigate(`/chat/${encoded}`);
  };
}

/**
 * Navigate to the settings of the avatar that depicts the signed-in user.
 *
 * Shared by every control that leads there — the menu entry and the sidebar
 * header — so that they all resolve the avatar the same way and land on the
 * same tab.
 *
 * @param {Function} [onNavigate] Called before navigating, to dismiss the
 *   panel or menu the control is rendered inside.
 * @returns {Function} An async handler that performs the navigation.
 */
export function usePersonalAvatarSettingsNavigation(onNavigate) {
  const openWorkspace = usePersonalAvatarWorkspaceNavigation(onNavigate);
  return () => openWorkspace('settings');
}

/**
 * The shared account actions.
 *
 * @param {Object} options
 * @param {'avatars'|'personalAvatar'} options.leadingAction Whether the list
 *   opens with the way back to the avatar gallery ('avatars') or goes straight
 *   to the personal avatar's settings ('personalAvatar').
 * @param {Function} options.onNavigate Called before navigating, to dismiss the
 *   panel or menu the items are rendered inside.
 * @param {string} options.currentPath The active route, for marking the current item.
 * @param {'list'|'icons'} [options.variant] Labeled rows, or the same actions
 *   as icons on the collapsed rail.
 */
const AccountMenu = ({
  leadingAction = 'avatars',
  onNavigate,
  currentPath,
  variant = 'list',
}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { logOut } = useAuth();
  const openPersonalWorkspace =
    usePersonalAvatarWorkspaceNavigation(onNavigate);
  const openPersonalAvatarSettings = () => openPersonalWorkspace('settings');
  const isInboxCurrent =
    currentPath === '/inbox' ||
    (Boolean(currentPath?.startsWith('/chat/')) &&
      searchParams.get('tab') === 'inbox');
  // Pending agent-inbox items, polled in the background; the badge is the
  // owner's first sign that something needs them.
  const inboxCount = useInboxCount();
  const iconOnly = variant === 'icons';
  const iconClass = 'w-4 h-4 shrink-0';

  const goTo = (path) => {
    onNavigate?.();
    navigate(path);
  };

  const items = (
    <>
      {leadingAction === 'avatars' && (
        <AccountMenuItem
          iconOnly={iconOnly}
          icon={<Users className={iconClass} />}
          label="Avatars"
          onClick={() => goTo('/avatars')}
          isCurrent={currentPath === '/avatars'}
        />
      )}
      <AccountMenuItem
        iconOnly={iconOnly}
        icon={<UserCog className={iconClass} />}
        label="Your avatar's settings"
        onClick={openPersonalAvatarSettings}
      />
      <AccountMenuItem
        iconOnly={iconOnly}
        icon={<Inbox className={iconClass} />}
        label={
          iconOnly ? (
            'Avatar Inbox'
          ) : (
            <span className="flex items-center gap-2">
              Avatar Inbox
              {inboxCount > 0 && (
                <span
                  aria-label={`${inboxCount} items waiting`}
                  className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-amber-400 text-neutral-900 text-xs font-semibold flex items-center justify-center"
                >
                  {inboxCount > 99 ? '99+' : inboxCount}
                </span>
              )}
            </span>
          )
        }
        ariaLabel="Avatar Inbox"
        badgeCount={iconOnly ? inboxCount : 0}
        onClick={() => openPersonalWorkspace('inbox')}
        isCurrent={isInboxCurrent}
      />
      <AccountMenuItem
        iconOnly={iconOnly}
        icon={<Settings className={iconClass} />}
        label="Account settings"
        onClick={() => goTo('/account')}
        isCurrent={currentPath === '/account'}
      />
      <AccountMenuItem
        iconOnly={iconOnly}
        icon={<CreditCard className={iconClass} />}
        label="Billing"
        onClick={() => goTo('/billing')}
        isCurrent={currentPath === '/billing'}
      />
      <AccountMenuItem
        iconOnly={iconOnly}
        icon={<LogOut className={iconClass} />}
        label="Log out"
        isDanger
        onClick={() => {
          onNavigate?.();
          // Not awaited on purpose. logOut clears the local session before it
          // returns and revokes the session at the API afterwards, so waiting
          // here would only hold the person on a signed-out page until Auth0
          // answered — the delay that made this entry look unresponsive to a
          // single press.
          logOut();
          navigate('/login');
        }}
      />
    </>
  );

  return iconOnly ? (
    <div className="flex flex-col items-center gap-0.5">{items}</div>
  ) : (
    items
  );
};

export default AccountMenu;
