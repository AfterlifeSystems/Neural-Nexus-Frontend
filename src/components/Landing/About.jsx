// src/components/Landing/About.jsx
import React from 'react';

export default function About() {
  return (
    <section
      id="about"
      className="py-16 bg-neutral-200 text-neutral-900"
    >
      <div className="container mx-auto">
        <h2 className="text-3xl font-bold text-center mb-8">
          About Neural Nexus
        </h2>
        <p className="text-lg text-center">
          Our mission is to empower human communication through advanced AI and
          neural technologies, creating a future where interactions are seamless
          and meaningful. We aim towards extending human consciousness,
          improving health and well being through self-awareness, and augmenting
          human capability and means of interfacing with technologies in the
          future.
        </p>
      </div>
    </section>
  );
}
