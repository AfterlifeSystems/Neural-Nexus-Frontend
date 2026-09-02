// src/components/Landing/ScanToStart.jsx
import React from 'react';
import qrCode from '../../assets/qr-neuralnexus.png';

// The QR encodes https://bit.ly/4wfBJZn?r=qr, which redirects to the site root.
// It is deliberately not a link: on the page it already points at, a click would
// only reload. It exists to be scanned off a screen by someone else's phone, so
// the plaque stays white and keeps the code's quiet zone intact — a gray-tinted
// or tightly cropped QR is measurably slower for a camera to lock onto.
//
// Sits beside the headline on lg and up, so it costs the hero no vertical space
// above the demo; below lg it centres under the headline.
export default function ScanToStart({ className = '' }) {
  return (
    <div
      className={`inline-flex w-max flex-col items-center gap-3 rounded-2xl border border-neutral-700 bg-black/40 p-4 text-center shadow-xl shadow-neutral-500/10 backdrop-blur-md ${className}`}
    >
      <div className="rounded-xl bg-white p-2">
        <img
          src={qrCode}
          alt="QR code linking to neuralnexus.site"
          width={112}
          height={112}
          className="h-28 w-28"
        />
      </div>

      <div>
        <p className="font-semibold leading-snug text-neutral-200">
          Scan to open on your phone
        </p>
        <p className="mt-1 text-sm text-neutral-400/80">No signup required</p>
      </div>
    </div>
  );
}
