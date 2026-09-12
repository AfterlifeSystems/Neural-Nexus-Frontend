// src/components/MessageAuthorIcon.jsx
//
// The face beside a message: whoever said it. Both sides get one so a long
// conversation stays readable at a glance without relying on which edge a
// bubble is stuck to. A portrait is often absent — a new avatar has none until
// one is uploaded — so the placeholder is the normal case rather than an error
// state.
//
// For the avatar's replies the face follows the reply: when generated faces are
// on for this avatar, the reply's classified emotion is not neutral, and a
// still exists for that emotion, that still is shown in place of the
// portrait, so a joyful answer is delivered by a joyful face. The Settings
// crop still frames that still.

import React from 'react';
import { User } from 'lucide-react';
import { isValidImageUrl } from './utils';
import { stillFor } from '../hooks/useEmotionMedia';
import { speakingGlowStyle } from './speakingIndicator';
import ProfileBubbleImage from './ProfileBubbleImage';

const discClassName =
  'relative w-8 h-8 rounded-full bg-black/50 border border-white/10 overflow-hidden';

/**
 * @param {Object} props
 * @param {string} [props.portrait]
 * @param {string} props.name
 * @param {string} [props.emotion]
 * @param {Object} [props.emotionMedia]
 * @param {boolean} [props.showGenerated]
 * @param {boolean} [props.isSpeaking] Pulse the identity disc while this person talks.
 * @param {{fill?: string, ring?: string}|null} [props.speakingColor] Identity colour for the pulse.
 * @param {string|null} [props.assistantId] Applies the profile-bubble crop from settings.
 * @param {Function} [props.onClick] Opens Avatar Settings for this face.
 */
export default function MessageAuthorIcon({
  portrait,
  name,
  emotion,
  emotionMedia,
  showGenerated = false,
  isSpeaking = false,
  speakingColor = null,
  assistantId = null,
  onClick,
}) {
  const emotionStill =
    showGenerated && emotion && emotion !== 'neutral'
      ? stillFor(emotionMedia, emotion)
      : null;
  const face = emotionStill ?? portrait;
  const faceAlt = emotionStill ? `${name} (${emotion})` : name;
  const openSettingsLabel = `Open avatar settings for ${name}`;
  const faceNode =
    face && isValidImageUrl(face) ? (
      <ProfileBubbleImage
        src={face}
        alt={faceAlt}
        assistantId={assistantId}
        className="h-full w-full"
      />
    ) : (
      <User className="absolute inset-0 m-auto w-4 h-4 text-white/40" />
    );

  return (
    <div className="relative w-8 h-8 shrink-0">
      {isSpeaking && (
        <div
          className="voice-speak-glow absolute -inset-0.5 z-10 rounded-full"
          style={speakingGlowStyle(speakingColor)}
          aria-hidden
        />
      )}
      {typeof onClick === 'function' ? (
        <button
          type="button"
          onClick={onClick}
          title={
            emotionStill ? `${emotion} — ${openSettingsLabel}` : openSettingsLabel
          }
          aria-label={openSettingsLabel}
          className={`profile-bubble-disc ${discClassName} hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20`}
        >
          {faceNode}
        </button>
      ) : (
        <div
          className={discClassName}
          title={emotionStill ? emotion : undefined}
        >
          {faceNode}
        </div>
      )}
    </div>
  );
}
