// src/components/Landing/Hero.jsx
import React, { useEffect, useRef } from 'react';
import NET from 'vanta/dist/vanta.net.min';
import * as THREE from 'three';
import LiveAvatarDemo from './LiveAvatarDemo';
import ScanToStart from './ScanToStart';

export default function Hero() {
  const vantaRef = useRef(null);

  useEffect(() => {
    let vantaEffect;
    if (vantaRef.current && !vantaEffect) {
      vantaEffect = NET({
        el: vantaRef.current,
        THREE,
        color: 0x14b8a6, // Teal lines
        backgroundColor: 0x301934,
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 200.0,
        minWidth: 200.0,
        scale: 1.0,
        scaleMobile: 1.0,
        points: 10.0,
        maxDistance: 20.0,
        spacing: 15.0,
      });
    }
    return () => {
      if (vantaEffect) vantaEffect.destroy();
    };
  }, []);

  return (
    <section
      id="home"
      ref={vantaRef}
      className="min-h-screen flex items-center justify-center text-white relative py-16 lg:py-28"
    >
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center z-10">
        {/* The QR sits alongside the headline from lg up rather than beneath it,
            so it adds no height above the demo on short laptop viewports. */}
        <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-10 lg:text-left">
          <div className="lg:flex-1">
            <h2 className="text-4xl md:text-6xl lg:text-5xl xl:text-6xl font-bold mb-4">
              Extend Consciousness with Authentic Artificial Intelligence
            </h2>
            <p className="text-lg md:text-xl">
              Create custom Avatars powered by word-of-mouth stories, social
              media, and personal data for seamless, authentic interactions.
            </p>
          </div>
          <ScanToStart className="lg:shrink-0" />
        </div>

        <div className="mt-8">
          <LiveAvatarDemo isEmbeddedInHero />
        </div>
      </div>
    </section>
  );
}
