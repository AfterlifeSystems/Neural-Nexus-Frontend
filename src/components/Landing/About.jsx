// src/components/Landing/About.jsx
import React from 'react';

export default function About() {
  return (
    <section
      id="about"
      className="py-16 bg-gradient-to-b from-white to-purple bg-gray-100 text-gray-800"
    >
      <div className="container mx-auto">
        <h2 className="text-3xl font-bold text-center mb-8">
          About Neural Nexus
        </h2>
        <p className="text-lg text-center">
          Our mission is to empower human communication through advanced AI and
          neural technologies, creating a future where interactions are seamless
          and meaningful. We aim towards enabling those with unmet medical needs
          to interface with the world and to augment human capability in the
          future.
        </p>
      </div>
    </section>
  );
}
