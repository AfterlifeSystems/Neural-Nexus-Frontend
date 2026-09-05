// src/config/evanAssist.js
//
// Evan is the publicly shared avatar that helps anyone using Neural Nexus:
// a floating chat from the sidebar "?", screen observations, and live
// speech-to-text. The assistant id is deployment configuration so a new
// public Evan can be pointed at without a code change.
//
// When VITE_EVAN_ASSISTANT_ID is unset, the landing-page demo avatar is used.
// That is the same public share this product already publishes.

import { DEMO_ASSISTANT_ID } from './demoAvatar';

export const EVAN_DISPLAY_NAME = 'Evan';

export const EVAN_ASSISTANT_ID =
  import.meta.env.VITE_EVAN_ASSISTANT_ID || DEMO_ASSISTANT_ID;
