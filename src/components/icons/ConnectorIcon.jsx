// src/components/icons/ConnectorIcon.jsx
import React from 'react';
import { Instagram, Mail, Twitch, Twitter, Youtube, Plug } from 'lucide-react';

/**
 * The badge shown beside a provider's name on a connect card.
 *
 * Keyed by the `icon_key` the API sends rather than by a URL, so the backend
 * never dictates where this app keeps its artwork and a client with a different
 * icon set can map the same key to its own. An unknown key falls back to a
 * generic plug instead of rendering nothing, because a provider added to the
 * registry before this map is updated should still produce a usable card.
 */
const CONNECTOR_ICONS = {
  gmail: { Icon: Mail, tint: 'text-red-400', ring: 'border-red-400/30' },
  youtube: { Icon: Youtube, tint: 'text-red-500', ring: 'border-red-500/30' },
  twitter: { Icon: Twitter, tint: 'text-sky-400', ring: 'border-sky-400/30' },
  instagram: {
    Icon: Instagram,
    tint: 'text-pink-400',
    ring: 'border-pink-400/30',
  },
  twitch: { Icon: Twitch, tint: 'text-purple-400', ring: 'border-purple-400/30' },
};

const ConnectorIcon = ({ iconKey, className = '' }) => {
  const { Icon, tint, ring } = CONNECTOR_ICONS[iconKey] ?? {
    Icon: Plug,
    tint: 'text-white/60',
    ring: 'border-white/20',
  };

  return (
    <div
      className={`w-10 h-10 shrink-0 rounded-lg bg-white/10 border ${ring} flex items-center justify-center ${className}`}
    >
      <Icon className={`w-5 h-5 ${tint}`} aria-hidden="true" />
    </div>
  );
};

export default ConnectorIcon;
