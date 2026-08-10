// Temporary layout harness: mounts Hero + Header chrome without the auth stack,
// so the landing layout can be checked without Firebase credentials.
import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import Hero from './components/Landing/Hero';

createRoot(document.getElementById('root')).render(
  <div className="min-h-screen flex flex-col">
    <Hero />
  </div>
);
