// src/components/AccountMenu.jsx
//
// The account actions, defined once. They appear in two places — the sidebar
// and the User Settings menu on the avatar screen — and the only difference
// between them is the first entry: the sidebar leads back to the avatar
// gallery, while the User Settings menu leads to the settings of the avatar
// that depicts you. Everything else is shared here so the two cannot drift
// into offering different things.

import React from 'react';
import { CreditCard, Settings, LogOut, Users, UserCog } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { getPersonalAvatar } from '../services/avatarService';

/**
 * One row of the account menu.
 */
export const AccountMenuItem = ({ icon, label, onClick, isCurrent, isDanger }) => (
  <button
    onClick={onClick}
    aria-current={isCurrent ? 'page' : undefined}
    className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
      isDanger
        ? 'text-red-400 hover:bg-red-900/40 hover:text-white'
        : isCurrent
          ? 'bg-white/15 text-white'
          : 'text-white/70 hover:bg-white/10 hover:text-white'
    }`}
  >
    {icon}
    {label}
  </button>
);

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
    console.error('Could not resolve the personal avatar:', personalAvatarError);
    return null;
  }
}

/**
 * The shared account actions.
 *
 * @param {Object} options
 * @param {'avatars'|'personalAvatar'} options.leadingAction Which entry leads.
 * @param {Function} options.onNavigate Called before navigating, to dismiss the
 *   panel or menu the items are rendered inside.
 * @param {string} options.currentPath The active route, for marking the current item.
 */
const AccountMenu = ({ leadingAction = 'avatars', onNavigate, currentPath }) => {
  const navigate = useNavigate();
  const { userAvatars, logOut } = useAuth();

  const goTo = (path) => {
    onNavigate?.();
    navigate(path);
  };

  const openPersonalAvatarSettings = async () => {
    const personalAvatarId = await resolvePersonalAvatarId(userAvatars);
    onNavigate?.();
    if (!personalAvatarId) {
      // Saying nothing would look like a dead button.
      const { toast } = await import('react-hot-toast');
      toast.error('You do not have a personal avatar yet.');
      return;
    }
    // The settings live on a tab of the avatar's own screen; the query
    // parameter opens that tab directly rather than landing on the chat.
    navigate(`/chat/${personalAvatarId}?tab=settings`);
  };

  return (
    <>
      {leadingAction === 'avatars' ? (
        <AccountMenuItem
          icon={<Users className="w-4 h-4 shrink-0" />}
          label="Avatars"
          onClick={() => goTo('/avatars')}
          isCurrent={currentPath === '/avatars'}
        />
      ) : (
        <AccountMenuItem
          icon={<UserCog className="w-4 h-4 shrink-0" />}
          label="Your avatar's settings"
          onClick={openPersonalAvatarSettings}
        />
      )}
      <AccountMenuItem
        icon={<Settings className="w-4 h-4 shrink-0" />}
        label="Account settings"
        onClick={() => goTo('/account')}
        isCurrent={currentPath === '/account'}
      />
      <AccountMenuItem
        icon={<CreditCard className="w-4 h-4 shrink-0" />}
        label="Billing"
        onClick={() => goTo('/billing')}
        isCurrent={currentPath === '/billing'}
      />
      <AccountMenuItem
        icon={<LogOut className="w-4 h-4 shrink-0" />}
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
};

export default AccountMenu;
