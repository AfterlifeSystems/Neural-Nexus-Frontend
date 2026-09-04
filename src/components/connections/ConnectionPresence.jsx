// src/components/connections/ConnectionPresence.jsx
import React from 'react';

/**
 * Reachability of a machine: online or offline. Listing the machine already
 * means it has been added, so this is the only status chip it needs.
 *
 * @param {Object} parameters
 * @param {boolean} parameters.online Whether the machine is reachable now.
 */
const ConnectionPresence = ({ online }) => (
  <span
    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs border shrink-0 ${
      online
        ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
        : 'bg-white/10 border-white/10 text-white/60'
    }`}
  >
    {online ? 'Online' : 'Offline'}
  </span>
);

export default ConnectionPresence;
