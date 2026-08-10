// src/components/Landing/LiveAvatarDemo.jsx
import React, { useState } from 'react';
import LoadingSpinner from '../LoadingSpinner';
import {
  buildStreamlitEmbedUrl,
  buildStreamlitStandaloneUrl,
} from '../../config/demoAvatar';

export default function LiveAvatarDemo() {
  // Cleared by the iframe's onLoad handler. Streamlit Community Cloud puts
  // applications to sleep after inactivity, so a cold open can take several
  // seconds before the first frame paints.
  const [isFrameLoaded, setIsFrameLoaded] = useState(false);

  const embedUrl = buildStreamlitEmbedUrl();
  const standaloneUrl = buildStreamlitStandaloneUrl();

  return (
    <section
      id="demo"
      className="py-16 bg-gradient-to-b from-[#301934] to-purple-900 text-white scroll-mt-20 lg:scroll-mt-24"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-center mb-2">
          Talk to a Live Avatar
        </h2>
        <p className="text-center text-teal-300/80 mb-8">
          No signup required — the conversation below is running against a real
          Neural Nexus avatar right now.
        </p>

        <div className="relative w-full h-[min(80vh,720px)] min-h-[560px] rounded-2xl overflow-hidden border border-teal-500/30 shadow-2xl shadow-teal-500/20 bg-black/40">
          <iframe
            src={embedUrl}
            title="Neural Nexus live avatar demo"
            allow="clipboard-write; microphone"
            referrerPolicy="no-referrer-when-downgrade"
            onLoad={() => setIsFrameLoaded(true)}
            className="w-full h-full border-0"
          />

          {!isFrameLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/40 backdrop-blur-sm pointer-events-none">
              <LoadingSpinner />
              <p className="text-sm text-teal-300/80">Waking the avatar…</p>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-sm text-gray-400">
          Trouble loading?{' '}
          <a
            href={standaloneUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal-300 hover:text-teal-200 underline underline-offset-4 transition-colors duration-300"
          >
            Open the full demo in a new tab
          </a>
        </p>
      </div>
    </section>
  );
}
