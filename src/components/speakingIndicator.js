// src/components/speakingIndicator.js
//
// The highlight on a bubble (or the glow around a face) while that person is
// speaking. Avatar replies and the signed-in person's own messages use the
// house atmosphere speak glow; a colour is only passed for overheard
// third-party voices, which carry their own identity disc colour.

import { rgbChannelsOf } from '../config/avatarColorScheme.js';

export const SPEAKING_BUBBLE_HIGHLIGHT =
  'ring-2 ring-[rgb(135,206,250)]/80 border-[rgb(135,206,250)]/50 bg-[rgb(135,206,250)]/10';

/**
 * CSS variables that recolour `voice-speak-glow` without changing its shape.
 *
 * @param {{fill?: string, ring?: string}|null|undefined} color
 * @returns {Object|undefined}
 */
export function speakingGlowStyle(color) {
  const rgb = rgbChannelsOf(color?.fill);
  if (!rgb) return undefined;
  const bright = rgbChannelsOf(color?.ring) ?? rgb;
  return {
    '--voice-speak-rgb': rgb,
    '--voice-speak-bright-rgb': bright,
  };
}

/**
 * Class and inline style for a bubble that is currently being spoken.
 *
 * @param {{fill?: string}|null|undefined} [color] Identity colour; omit for atmosphere.
 * @returns {{className: string, style: Object|undefined}}
 */
export function speakingBubbleProps(color) {
  const fill = color?.fill;
  if (!fill) {
    return { className: SPEAKING_BUBBLE_HIGHLIGHT, style: undefined };
  }
  return {
    className: 'ring-2',
    style: {
      boxShadow: `0 0 0 2px ${fill}`,
      borderColor: fill,
      backgroundColor: `${fill}1A`,
    },
  };
}

/**
 * Whether this user bubble should wear the speaking indicator.
 *
 * Playback of that row's speech, or the live turn still being heard /
 * understood (the pending bubble).
 *
 * @param {Object} [state]
 * @param {string|null|undefined} [state.messageKey]
 * @param {string|null|undefined} [state.speakingKey]
 * @param {boolean} [state.liveSpeaking] The person is talking or dictating now.
 * @param {boolean} [state.isPending] This row is the in-flight spoken turn.
 * @returns {boolean}
 */
export function userResponseIsSpeaking({
  messageKey,
  speakingKey,
  liveSpeaking = false,
  isPending = false,
} = {}) {
  if (messageKey && speakingKey === messageKey) return true;
  return Boolean(liveSpeaking && isPending);
}

/**
 * Whether the voice-stage portrait should wear the speak glow.
 *
 * A personal avatar's own user-message replay still uses that avatar's voice,
 * so the portrait glows. On a character stage, user-message replay uses the
 * person's personal voice — not the character — so the character stays dark.
 *
 * @param {Object} [state]
 * @param {boolean} [state.isPlayingReply]
 * @param {boolean} [state.isSpeaking]
 * @param {boolean} [state.speakingUserMessage]
 * @param {boolean} [state.speakingComposerDraft]
 * @param {boolean} [state.hasLipSyncClip]
 * @param {boolean} [state.isPersonalAvatar]
 * @returns {boolean}
 */
export function avatarPortraitIsSpeaking({
  isPlayingReply = false,
  isSpeaking = false,
  speakingUserMessage = false,
  speakingComposerDraft = false,
  hasLipSyncClip = false,
  isPersonalAvatar = false,
} = {}) {
  if (isPlayingReply || hasLipSyncClip) return true;
  if (!isSpeaking || speakingComposerDraft) return false;
  if (speakingUserMessage && !isPersonalAvatar) return false;
  return true;
}
