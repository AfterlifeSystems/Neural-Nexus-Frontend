// src/components/Landing/Hero.jsx
import React, { useEffect, useRef } from 'react';
import NET from 'vanta/dist/vanta.net.min';
import * as THREE from 'three';
import { useNavigate } from 'react-router-dom'; // 1. Add this
import { useAuth } from '../../context/AuthContext'; // 2. Add this
export default function Hero() {
  const vantaRef = useRef(null);

  const navigate = useNavigate(); // 3. Initialize
  const { user } = useAuth(); // 4. Initialize

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

  const handleTryNow = () => {
    window.open('https://api.neuralnexus.site', '_blank');
    // if (user) {
    //   navigate('/avatars'); // Go to app if logged in
    // } else {
    //   navigate('/login'); // Go to login if not
    // }
  };

  return (
    <section
      id="home"
      ref={vantaRef}
      className="h-screen flex items-center justify-center text-white relative"
    >
      <div className="text-center z-10">
        <h2 className="text-4xl md:text-6xl font-bold mb-4">
          Extend Consciousness with Authentic Avatars
        </h2>
        <p className="text-lg md:text-xl mb-6">
          Create authentic AI avatars powered by social media and personal data
          for seamless, personalized interactions.
        </p>
      </div>
    </section>
  );
}
