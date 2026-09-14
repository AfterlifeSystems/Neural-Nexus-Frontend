// Official GitHub Sponsors button for efwoods.
// https://github.com/sponsors/efwoods
//
// The frame is GitHub's published widget, not a restyle.

import React from 'react';

import { GITHUB_SPONSORS_BUTTON_EMBED } from '../services/githubSponsors';

/**
 * The official 114×32 GitHub Sponsors button.
 */
export function GitHubSponsorsButton() {
  return (
    <iframe
      src={GITHUB_SPONSORS_BUTTON_EMBED.src}
      title={GITHUB_SPONSORS_BUTTON_EMBED.title}
      height={GITHUB_SPONSORS_BUTTON_EMBED.height}
      width={GITHUB_SPONSORS_BUTTON_EMBED.width}
      className="border-0 rounded-md"
    />
  );
}

/**
 * The GitHub Sponsors button, wrapped so a caller can place it with layout
 * classes. The card and the "Sponsor on GitHub" text are not shown: the
 * button is the control.
 *
 * @param {Object} parameters
 * @param {string} [parameters.className] Layout classes for the outer wrap.
 */
const GitHubSponsorsEmbed = ({ className = '' }) => (
  <div className={className}>
    <GitHubSponsorsButton />
  </div>
);

export default GitHubSponsorsEmbed;
