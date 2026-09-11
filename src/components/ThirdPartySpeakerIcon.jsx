// src/components/ThirdPartySpeakerIcon.jsx
//
// The face beside an overheard voice: an animal disc, not the signed-in
// person's portrait. Same size as MessageAuthorIcon. The disc is neutral
// until there is a second voice to tell it apart from; then it wears the
// colour that voice was dealt.

import React from 'react';

/**
 * @param {Object} props
 * @param {{name: string, emoji: string, fill: string|null, ring: string|null}} props.identity
 */
export default function ThirdPartySpeakerIcon({ identity }) {
  if (!identity) return null;
  const coloured = Boolean(identity.fill);
  return (
    <div
      className={`w-8 h-8 shrink-0 rounded-full overflow-hidden flex items-center justify-center text-base leading-none ${
        coloured ? '' : 'bg-black/50 border border-white/10'
      }`}
      style={
        coloured
          ? {
              backgroundColor: identity.fill,
              boxShadow: `inset 0 0 0 1px ${identity.ring ?? identity.fill}`,
            }
          : undefined
      }
      title={identity.name}
    >
      <span aria-hidden="true">{identity.emoji}</span>
      <span className="sr-only">{identity.name}</span>
    </div>
  );
}
