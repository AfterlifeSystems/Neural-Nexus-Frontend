// src/components/Landing/Footer.jsx
import React from 'react';

export default function Footer() {
  return (
    <footer className="bg-purple-900 text-white py-4">
      <div className="container mx-auto text-center">
        <p>© 2026 Afterlife Systems Inc. All rights reserved.</p>
        <a
          href="/privacy"
          className="mx-2 text-purple-300 hover:text-purple-100 transition"
        >
          Privacy Policy
        </a>
        <a
          href="/terms"
          className="mx-2 text-purple-300 hover:text-purple-100 transition"
        >
          Terms of Service
        </a>
      </div>
    </footer>
  );
}
