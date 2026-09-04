// src/components/Landing/LiveAvatarDemo.jsx
import React, { useState } from 'react';
import LoadingSpinner from '../LoadingSpinner';
import { buildSharedAvatarDemoUrl } from '../../config/demoAvatar';

// `isEmbeddedInHero` drops the standalone section chrome (its own gradient
// background and vertical padding) so the demo can sit directly on top of the
// hero's animated background instead of below it as a separate band.
export default function LiveAvatarDemo({ isEmbeddedInHero = false }) {
  // Cleared by the iframe's onLoad handler. The framed page is this same
  // application booting a second time, so the panel is empty for the moment
  // that takes.
  const [isFrameLoaded, setIsFrameLoaded] = useState(false);

  const sharedAvatarUrl = buildSharedAvatarDemoUrl();

  const SectionElement = isEmbeddedInHero ? 'div' : 'section';

  return (
    <SectionElement
      id="demo"
      className={
        isEmbeddedInHero
          ? 'w-full text-neutral-200 scroll-mt-20 lg:scroll-mt-24'
          : 'py-16 bg-gradient-to-b from-black to-black text-neutral-200 scroll-mt-20 lg:scroll-mt-24'
      }
    >
      <div
        className={
          isEmbeddedInHero ? 'w-full' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'
        }
      >
        {!isEmbeddedInHero && (
          <h2 className="text-3xl font-bold text-center mb-2">
            Talk to a Live Avatar
          </h2>
        )}
        {/* In the hero this line is carried by <ScanToStart>, which sits
            directly above and pairs it with the QR code. */}
        {!isEmbeddedInHero && (
          <p className="text-center text-neutral-400/80 mb-8">
            No signup required — the conversation below is running against a
            real Neural Nexus avatar right now.
          </p>
        )}

        <div
          className={`relative w-full rounded-2xl overflow-hidden border border-neutral-700 shadow-2xl shadow-white/5 bg-black/40 ${
            isEmbeddedInHero
              ? 'h-[clamp(460px,calc(100vh-22rem),680px)]'
              : 'h-[min(80vh,720px)] min-h-[560px]'
          }`}
        >
          {/* The shared-avatar page, exactly as a visitor following a share
              link sees it: no account, no credential, its own anonymous
              conversation. The empty chat inside offers a one-tap opening
              question — see OPENING_QUESTION in
              src/components/SharedAvatarChat.jsx — so a visitor who has not
              thought of anything to say still gets the avatar to introduce
              itself. Framing it rather than rendering the chat inline
              keeps that conversation's state — the active avatar, the message
              stream, the remembered threads — in its own document, where it
              cannot collide with the landing page around it. */}
          <iframe
            src={sharedAvatarUrl}
            title="Neural Nexus live avatar demo"
            allow="clipboard-write; microphone; camera; display-capture; autoplay"
            referrerPolicy="no-referrer-when-downgrade"
            onLoad={() => setIsFrameLoaded(true)}
            className="w-full h-full border-0 bg-black"
          />

          {!isFrameLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/40 backdrop-blur-sm pointer-events-none">
              <LoadingSpinner />
              <p className="text-sm text-neutral-400/80">Waking the avatar…</p>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-sm text-neutral-400">
          <a
            href={sharedAvatarUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-300 hover:text-neutral-100 underline underline-offset-4 transition-colors duration-300"
          >
            Open the full demo in a new tab
          </a>
        </p>
      </div>
    </SectionElement>
  );
}
