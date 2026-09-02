// src/components/Landing/Founder.jsx
//
// Who is behind this. A product that asks people to hand over their own words
// and likeness should say plainly whose hands those go into.

import React, { useState } from 'react';
import { Github, Linkedin, Mail, User } from 'lucide-react';

// GitHub serves every account's picture at this address, so the portrait stays
// current if it is ever changed there — no copy of it lives in this repository.
const FOUNDER = {
  name: 'Evan Woods',
  role: 'Founder & Engineer',
  portraitUrl: 'https://github.com/efwoods.png',
  githubUrl: 'https://github.com/efwoods',
  linkedinUrl: 'https://www.linkedin.com/in/evanfwoods/',
  email: 'contact@neuralnexus.site',
};

export default function Founder() {
  // A portrait served from another origin can be blocked or simply fail; a
  // placeholder is better than a broken frame.
  const [hasPortraitFailed, setHasPortraitFailed] = useState(false);

  return (
    <section
      id="founder"
      className="py-16 bg-gradient-to-b from-black to-black text-neutral-200"
    >
      <div className="container mx-auto">
        <h2 className="text-3xl font-bold text-center mb-8">The Founder</h2>

        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center gap-8 bg-black/60 border border-white/10 rounded-2xl p-8">
          <img
            src={FOUNDER.portraitUrl}
            alt={FOUNDER.name}
            className="w-40 h-40 rounded-2xl object-cover border border-white/10 shrink-0"
            loading="lazy"
          />

          <div className="flex flex-col gap-3 text-center sm:text-left">
            <div>
              <h3 className="text-2xl font-semibold">{FOUNDER.name}</h3>
              <p className="text-neutral-300">{FOUNDER.role}</p>
            </div>

            <p className="text-white/80">
              A strong data science and engineering professional. I created the
              Neural Nexus to capture, share, and celebrate the memories of
              loved ones as an interactive digital memorialization. I hope you
              use the Neural Nexus to share and understand yourself and improve
              the quality of your life.
            </p>

            <div className="flex gap-3 justify-center sm:justify-start pt-1">
              <a
                href={FOUNDER.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 rounded-lg bg-black/50 border border-white/10 hover:border-neutral-300/60 hover:bg-white/10 transition-colors flex items-center gap-2"
              >
                <Github className="w-4 h-4" />
                GitHub
              </a>
              <a
                href={FOUNDER.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 rounded-lg bg-black/50 border border-white/10 hover:border-neutral-300/60 hover:bg-white/10 transition-colors flex items-center gap-2"
              >
                <Linkedin className="w-4 h-4" />
                LinkedIn
              </a>
              <a
                href={`mailto:${FOUNDER.email}`}
                className="px-3 py-2 rounded-lg bg-black/50 border border-white/10 hover:border-neutral-300/60 hover:bg-white/10 transition-colors flex items-center gap-2"
              >
                <Mail className="w-4 h-4" />
                Email
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
