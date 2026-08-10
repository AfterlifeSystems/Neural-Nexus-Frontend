// src/components/Landing/Careers.jsx
import React from 'react';

export default function Careers() {
  return (
    <section
      id="careers"
      className="py-16 bg-gradient-to-b bg-purple-900 to-purple-400 text-white"
    >
      <div className="container mx-auto">
        <h2 className="text-3xl font-bold text-center mb-8">
          Join Our Waitlist
        </h2>
        <p className="text-lg text-center">
          We’re seeking passionate early-adopters to pilot our cutting-edge
          software. Send an email now to join the waitlist and shape the future
          of AI!
        </p>
        <a
          href="mailto:waitlist@neuralnexus.site"
          className="block text-center text-white hover:underline hover:text-purple-200 transition"
        >
          waitlist@neuralnexus.site
        </a>
      </div>
    </section>
  );
}
