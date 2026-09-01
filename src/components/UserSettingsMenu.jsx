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
import { ChevronUp, Settings } from 'lucide-react';
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
          {/* The chevron is the affordance that says this control opens a
              menu; it points up because the menu opens upward, and turns
              over while the menu is open to point back at the way to close
              it. */}
          <ChevronUp
            className={`w-4 h-4 ml-auto transition-transform duration-300 ${
              isOpen ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </button>

        {/* Opens upward: the control sits at the foot of the page, so a menu
            dropping down would open off the bottom of the window.

            `bottom-full` puts the menu's lower edge on the button's upper edge,
            whatever the button's height, with `mb-2` for the gap. The offset
            used to be a fixed `bottom-[50px]`, which assumed a button 50px
            tall: "User Settings" wraps to two lines inside `w-48` on plenty of
            systems, making the button ~69px, and the menu then opened over its
            top ~19px. */}
        {isOpen && (
          <div
            id="user-menu"
            className="absolute bottom-full mb-2 w-full right-0 backdrop-blur-lg bg-white/10 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
          >
            {/* The name heads the menu only when there is one to show. An
                empty heading is a bar of blank space that reads as something
                having failed to load. Closing is the control that opened the
                menu, or a press outside it, so the menu carries no close
                button of its own. */}
            {profile?.username && (
              <div className="flex items-center px-4 py-2 border-b border-white/20">
                <span className="text-white text-sm font-semibold truncate">
                  {profile.username}
                </span>
              </div>
            )}
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
