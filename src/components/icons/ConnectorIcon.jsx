// src/components/icons/ConnectorIcon.jsx
import React from 'react';
import {
  Calendar,
  Facebook,
  Globe,
  Instagram,
  Linkedin,
  Mail,
  Plug,
  Twitch,
  Youtube,
} from 'lucide-react';
import { FaAndroid, FaApple, FaDiscord, FaSlack, FaUbuntu, FaWindows } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import { VscMcp } from 'react-icons/vsc';

/**
 * The badge shown beside a provider's name on a connect card or a connection row.
 *
 * Keyed by the `icon_key` the API sends rather than by a URL, so the backend
 * never dictates where this app keeps its artwork and a client with a different
 * icon set can map the same key to its own. An unknown key falls back to a
 * generic plug instead of rendering nothing, because a provider added to the
 * registry before this map is updated should still produce a usable card.
 *
 * The set mirrors the sources on the welcome page's "Custom LLMs" card
 * (`Landing/Product.jsx`), drawn from the same icon packages so the two screens
 * show one mark per platform.
 */
const CONNECTOR_ICONS = {
  gmail: { Icon: Mail, tint: 'text-red-400', ring: 'border-red-400/30' },
  google_calendar: {
    Icon: Calendar,
    tint: 'text-sky-300',
    ring: 'border-sky-300/30',
  },
  youtube: { Icon: Youtube, tint: 'text-red-500', ring: 'border-red-500/30' },
  twitter: { Icon: FaXTwitter, tint: 'text-neutral-200', ring: 'border-white/20' },
  instagram: {
    Icon: Instagram,
    tint: 'text-pink-400',
    ring: 'border-pink-400/30',
  },
  twitch: { Icon: Twitch, tint: 'text-purple-300', ring: 'border-purple-300/30' },
  facebook: { Icon: Facebook, tint: 'text-blue-400', ring: 'border-blue-400/30' },
  linkedin: { Icon: Linkedin, tint: 'text-sky-400', ring: 'border-sky-400/30' },
  discord: { Icon: FaDiscord, tint: 'text-indigo-300', ring: 'border-indigo-300/30' },
  slack: { Icon: FaSlack, tint: 'text-emerald-300', ring: 'border-emerald-300/30' },
  apple: { Icon: FaApple, tint: 'text-neutral-200', ring: 'border-white/20' },
  ios: { Icon: FaApple, tint: 'text-neutral-200', ring: 'border-white/20' },
  android: { Icon: FaAndroid, tint: 'text-emerald-400', ring: 'border-emerald-400/30' },
  windows: { Icon: FaWindows, tint: 'text-sky-300', ring: 'border-sky-300/30' },
  ubuntu: { Icon: FaUbuntu, tint: 'text-orange-400', ring: 'border-orange-400/30' },
  mcp: { Icon: VscMcp, tint: 'text-neutral-200', ring: 'border-white/20' },
  desktop: { Icon: VscMcp, tint: 'text-neutral-200', ring: 'border-white/20' },
  custom: { Icon: Plug, tint: 'text-amber-300', ring: 'border-amber-300/30' },
  url: { Icon: Globe, tint: 'text-neutral-300', ring: 'border-white/20' },
};

const ConnectorIcon = ({ iconKey, className = '', size = 'md' }) => {
  const { Icon, tint, ring } = CONNECTOR_ICONS[iconKey] ?? {
    Icon: Plug,
    tint: 'text-white/60',
    ring: 'border-white/10',
  };
  const frame = size === 'sm' ? 'w-7 h-7 rounded-md' : 'w-10 h-10 rounded-lg';
  const glyph = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

  return (
    <div
      className={`${frame} shrink-0 bg-black/50 border ${ring} flex items-center justify-center ${className}`}
    >
      <Icon className={`${glyph} ${tint}`} aria-hidden="true" />
    </div>
  );
};

export default ConnectorIcon;
