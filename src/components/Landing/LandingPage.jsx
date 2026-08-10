// src/components/Landing/LandingPage.jsx
import React from 'react';
import Header from './Header';
import Hero from './Hero';
import Product from './Product';
import About from './About';
import Careers from './Careers';
import Contact from './Contact';
import Footer from './Footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <Hero /> {/* Hero now contains the embedded live avatar demo */}
      <Product />
      <About />
      <Careers />
      <Contact />
      <Footer />
    </div>
  );
}
