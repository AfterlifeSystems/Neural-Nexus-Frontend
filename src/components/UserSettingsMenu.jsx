// src/components/UserSettingsMenu.jsx
//
// The "User Settings" control that sits at the foot of a signed-in screen.
//
// It is its own component because it belongs to every signed-in screen rather
// than to the avatar gallery it first appeared on. Someone who opens Account
// Settings or Billing from this menu used to land on a page where the control
// that brought them there no longer existed, which reads as the page having
// lost its controls rather than as a menu that was only ever on one screen.
//
// The actions themselves come from AccountMenu, the single definition shared
// with the sidebar, so the two can never drift into offering different things.

import React, { useEffect, useRef, useState } from 'react';
import { Settings, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import AccountMenu from './AccountMenu';

/**
 * The account menu, opened from a control at the foot of the page.
 *
 * @param {Object} parameters
 * @param {'avatars'|'personalAvatar'} [parameters.leadingAction] Which entry
 *   leads the menu. A screen that already shows the avatar gallery leads with
 *   the personal avatar's settings instead, since the gallery is right there.
 * @param {string} [parameters.className] Layout classes for the outer wrapper.
 */
const UserSettingsMenu = ({
  leadingAction = 'personalAvatar',
  className = '',
}) => {
  const location = useLocation();
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  // Dismissing on a press outside is what makes this behave like a menu rather
  // than a panel that can only be closed by the control that opened it.
  useEffect(() => {
    const handlePressOutside = (pressEvent) => {
      if (menuRef.current && !menuRef.current.contains(pressEvent.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePressOutside);
    return () => document.removeEventListener('mousedown', handlePressOutside);
  }, []);

  return (
    <div
      className={`min-h-[40px] w-full flex justify-center items-center gap-2 ${className}`}
    >
      <div className="relative w-48" ref={menuRef}>
        <button
          onClick={() => setIsOpen((open) => !open)}
          className="bg-white/10 rounded-lg border border-white/20 py-2 px-4 text-white hover:bg-white/15 transition-all duration-300 flex items-center gap-2 w-full"
          aria-haspopup="true"
          aria-expanded={isOpen}
          aria-controls="user-menu"
        >
          <Settings className="w-6 h-6" />
          User Settings
        </button>

        {/* Opens upward: the control sits at the foot of the page, so a menu
            dropping down would open off the bottom of the window. */}
        {isOpen && (
          <div
            id="user-menu"
            className="absolute bottom-[50px] w-full mt-2 right-0 backdrop-blur-lg bg-white/10 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
          >
            <div className="flex justify-between items-center px-4 py-2 border-b border-white/20">
              <span className="text-white text-sm font-semibold truncate">
                {profile?.username}
              </span>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white hover:text-red-500 shrink-0"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 space-y-1">
              <AccountMenu
                leadingAction={leadingAction}
                onNavigate={() => setIsOpen(false)}
                currentPath={location.pathname}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserSettingsMenu;
