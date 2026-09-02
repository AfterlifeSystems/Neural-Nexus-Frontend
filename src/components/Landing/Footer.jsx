// src/components/Landing/Footer.jsx
import React from 'react';

export default function Footer() {
  return (
    <footer className="bg-black text-neutral-200 py-4">
      <div className="container mx-auto text-center">
        <p>© 2026 Afterlife Systems Inc. All rights reserved.</p>
        <a
          href="/privacy"
          className="mx-2 text-neutral-300 hover:text-neutral-100 transition"
        >
          Privacy Policy
        </a>
        <a
          href="/terms"
          className="mx-2 text-neutral-300 hover:text-neutral-100 transition"
        >
          Terms of Service
        </a>
      </div>
    </footer>
  );
}
