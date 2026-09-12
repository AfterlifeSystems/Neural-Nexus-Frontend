// src/components/Landing/LandingPage.jsx
import React from 'react';
import Header from './Header';
import Hero from './Hero';
import Product from './Product';
import About from './About';
import Founder from './Founder';
import Careers from './Careers';
import Contact from './Contact';
import Footer from './Footer';

export default function LandingPage() {
  return (
    // `relative z-10` lifts this screen above the full-viewport Vanta net.
    // Without it the DOM still has Product, About, and the rest — a copy of
    // the page text is complete — and the canvas paints over them.
    <div className="relative z-10 min-h-screen flex flex-col">
      <Header />
      <Hero /> {/* Hero now contains the embedded live avatar demo */}
      <Product />
      <About />
      <Founder />
      <Careers />
      <Contact />
      <Footer />
    </div>
  );
}
