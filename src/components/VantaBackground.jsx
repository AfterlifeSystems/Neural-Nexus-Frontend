// src/components/VantaBackground.jsx

import React, { useEffect, useRef } from 'react';
import NET from 'vanta/dist/vanta.net.min';
import * as THREE from 'three';

const VantaBackground = () => {
  const vantaRef = useRef(null);
  const vantaEffect = useRef(null);

  useEffect(() => {
    const applyControls = () => {
      const talking = document.documentElement.classList.contains(
        'voice-stage-open'
      );
      vantaEffect.current?.setOptions?.({
        mouseControls: !talking,
        touchControls: false,
      });
    };

    if (!vantaEffect.current && vantaRef.current) {
      vantaEffect.current = NET({
        el: vantaRef.current,
        THREE,
        color: 0x4a4335, // Warm gray lines, a hint of gold
        backgroundColor: 0x000000,
        mouseControls: true,
        // A finger pan is a scroll, not a camera orbit. Voice-mode chat
        // especially: the net used to slide under the captions.
        touchControls: false,
        gyroControls: false,
        minHeight: 200.0,
        minWidth: 200.0,
        scale: 1.0,
        scaleMobile: 1.0,
        points: 10.0,
        maxDistance: 20.0,
        spacing: 15.0,
      });
      applyControls();
    }

    const observer = new MutationObserver(applyControls);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      observer.disconnect();
      if (vantaEffect.current) {
        vantaEffect.current.destroy();
        vantaEffect.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={vantaRef}
      className="fixed inset-0"
      style={{ zIndex: 0 }}
    />
  );
};

export default VantaBackground;
