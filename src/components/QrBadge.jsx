// src/components/QrBadge.jsx
//
// The code that points at Neural Nexus, kept somewhere it can always be found
// and always be pointed at: the bottom-right corner of every page.
//
// It sits outside the routes rather than inside any screen, because it belongs
// to the product rather than to a page — and because a code someone else is
// meant to scan is useless if it only exists on the one screen you happen not
// to be on. It rests at low opacity so it never competes with the page, and
// comes forward when approached.

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import qrCode from '../assets/qr-neuralnexus-transparent.png';

// The landing page already devotes a section to this code at a size worth
// scanning, so the corner badge would only repeat it there.
const PATHS_WITH_THEIR_OWN_CODE = ['/welcome'];

const QrBadge = () => {
  const navigate = useNavigate();
  const location = useLocation();

  if (PATHS_WITH_THEIR_OWN_CODE.includes(location.pathname)) {
    return null;
  }

  return (
    <button
      onClick={() => navigate('/welcome')}
      // z-30 keeps it beneath the sidebar (40/50) and any modal (60/70): it is
      // the least important thing on screen and must never be in the way.
      className="group fixed bottom-4 right-4 z-30 p-2 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 opacity-40 hover:opacity-100 hover:border-teal-400/40 hover:bg-white/10 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:opacity-100"
      aria-label="Neural Nexus — scan or open the welcome page"
      title="Scan to share Neural Nexus, or press to open the welcome page"
    >
      <img
        src={qrCode}
        alt="QR code linking to Neural Nexus"
        className="w-14 h-14 sm:w-20 sm:h-20 transition-transform duration-300 group-hover:scale-105"
      />
    </button>
  );
};

export default QrBadge;
