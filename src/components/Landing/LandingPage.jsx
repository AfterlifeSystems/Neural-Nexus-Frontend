// src/components/Landing/LandingPage.jsx
import React, { useEffect, useRef } from 'react';
import NET from 'vanta/dist/vanta.net.min';
import * as THREE from 'three';
import Header from './Header';
import Hero from './Hero';
import Product from './Product';
import About from './About';
import Careers from './Careers';
import Contact from './Contact';
import Footer from './Footer';
import { Toaster } from 'react-hot-toast';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <Hero /> {/* Use ref with the Hero component */}
      <Product />
      <About />
      <Careers />
      <Contact />
      <Footer />
    </div>
  );
}
