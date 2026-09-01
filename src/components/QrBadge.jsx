// src/components/QrBadge.jsx
//
// The code that points at Neural Nexus, on the pages that carry it nowhere
// else: the bottom-right corner of the signed-out screens.
//
// It sits outside the routes rather than inside any screen, because it belongs
// to the product rather than to a page — and because a code someone else is
// meant to scan is useless if it only exists on the one screen you happen not
// to be on. It rests at low opacity so it never competes with the page, and
// comes forward when approached.

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { isSharedAvatarLinkPath } from './utils';
import qrCode from '../assets/qr-neuralnexus-transparent.png';

// The landing page already devotes a section to this code at a size worth
// scanning, so the corner badge would only repeat it there.
const PATHS_WITH_THEIR_OWN_CODE = ['/welcome'];

const QrBadge = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isRestoringSession } = useAuth();

  // Signed in, the sidebar carries the code — as an icon on the collapsed rail
  // and full size in the open panel — so this would be a second copy of it.
  // Floating, it also sat on top of the composer's send button on a narrow
  // window, which is the one place the code must never be. Waiting out the
  // session restore keeps it from flashing into the corner on every reload.
  if (user || isRestoringSession) {
    return null;
  }

  // A shared avatar link has that same sidebar without anyone being signed in,
  // so the test above misses it: the visitor's rail carries the code down the
  // left edge while this badge put a second one in the opposite corner. The
  // sidebar's copy is the one to keep — it is the code in the place the visitor
  // is already being taught to look.
  if (isSharedAvatarLinkPath(location.pathname)) {
    return null;
  }

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
