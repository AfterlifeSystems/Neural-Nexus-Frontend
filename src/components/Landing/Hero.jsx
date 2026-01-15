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
    if (user) {
      navigate('/avatars'); // Go to app if logged in
    } else {
      navigate('/login'); // Go to login if not
    }
  };

  return (
    <section
      id="home"
      ref={vantaRef}
      className="h-screen flex items-center justify-center text-white relative"
    >
      <div className="text-center z-10">
        <h2 className="text-4xl md:text-6xl font-bold mb-4">
          Revolutionize Communication with AI Avatars
        </h2>
        <p className="text-lg md:text-xl mb-6">
          Create custom AI avatars powered by neural data for seamless,
          personalized interactions.
        </p>
        <div className="flex justify-center">
          <button
            onClick={handleTryNow}
            className="relative px-6 py-3 bg-gradient-to-r bg-white/5 text-white font-semibold rounded-lg overflow-hidden group hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-300"
          >
            <span className="relative z-10">Try Now</span>
            <div className="absolute inset-0 bg-gradient-to-r from-teal-500 to-teal-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="absolute inset-0 bg-white/20 translate-x-full group-hover:translate-x-0 transition-transform duration-500 skew-x-12"></div>
          </button>
        </div>
      </div>
    </section>
  );
}
