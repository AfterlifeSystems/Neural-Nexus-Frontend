// src/components/Landing/Careers.jsx
import React from 'react';
import { Mail } from 'lucide-react';

const WAITLIST_EMAIL = 'waitlist@neuralnexus.site';

export default function Careers() {
  return (
    <section
      id="careers"
      className="py-16 bg-gradient-to-b bg-purple-900 to-purple-400 text-white"
    >
      <div className="container mx-auto flex flex-col items-center">
        {/* The heading is the action. It read as a title with the address
            printed underneath, which left the reader to work out that the
            address was the way in; pressing the thing that names the offer is
            what people try first. */}
        <a
          href={`mailto:${WAITLIST_EMAIL}`}
          className="text-3xl font-bold text-center mb-8 px-6 py-3 rounded-xl bg-white/10 border border-white/20 hover:bg-teal-600 hover:border-teal-400 transition-all duration-300 flex items-center gap-3 focus:outline-none focus:ring-2 focus:ring-teal-400"
        >
          <Mail className="w-7 h-7" />
          Join Our Waitlist
        </a>
        <p className="text-lg text-center">
          We’re seeking passionate early-adopters to pilot our cutting-edge
          software. Send an email now to join the waitlist and shape the future
          of AI!
        </p>
        <a
          href={`mailto:${WAITLIST_EMAIL}`}
          className="block text-center text-white hover:underline hover:text-purple-200 transition mt-2"
        >
          {WAITLIST_EMAIL}
        </a>
      </div>
    </section>
  );
}
