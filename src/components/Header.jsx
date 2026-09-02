// src/components/Header.jsx

import React from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import AuthComponent from './AuthComponent';

const Header = ({
  sidebarVisible,
  setSidebarVisible,
  setActiveTab,
  onEndLiveChat,
}) => {
  return (
    <header className="w-full bg-black/50 backdrop-blur-sm border-b border-neutral-700 sticky top-0 z-50 rounded-2xl px-2">
      <div className="flex justify-between items-center px-2 py-3 mx-auto">
        {/* Left side: Avatar/Sidebar toggle button */}
        <div className="flex items-center">
          <button
            onClick={() => setSidebarVisible((v) => !v)}
            className="text-sm px-2 sm:px-4 py-1 sm:py-2 transition-transform duration-300 hover:scale-105 rounded hover:bg-neutral-900 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/50 border border-neutral-700 text-neutral-200 bg-black/60 font-semibold shadow-lg flex items-center justify-center gap-2"
            aria-label={sidebarVisible ? 'Close Sidebar' : 'Open Sidebar'}
          >
            <span className="portrait:hidden">Avatars</span>
            {sidebarVisible ? (
              <PanelLeftClose className="w-4 h-4 sm:w-4 sm:h-5 web:ml-2 landscape:ml-2" />
            ) : (
              <PanelLeftOpen className="w-4 h-4 sm:w-4 sm:h-5 web:ml-2 landscape:ml-2" />
            )}
          </button>
        </div>

        {/* Center: Neural Nexus title */}
        <div className="flex-1 flex justify-center items-center">
          <a
            href="/"
            className="text-sm sm:text-base font-bold text-neutral-200 tracking-wide"
          >
            Neural Nexus
          </a>
        </div>

        {/* Right side: Auth component */}
        <div className="flex items-center">
          <AuthComponent
            setActiveTab={setActiveTab}
            onEndLiveChat={onEndLiveChat}
          />
        </div>
      </div>
    </header>
  );
};

export default Header;
