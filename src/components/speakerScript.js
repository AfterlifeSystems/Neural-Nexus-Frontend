// src/components/speakerScript.js
//
// Pure helpers for speaker-labelled spoken turns (kept apart from the
// component so Fast Refresh can reload the component alone).
//
// Other voices in the room are their own bubbles on the person's side, each
// with a stable animal identity (coloured only once there is a second voice
// to tell it from). The signed-in person and this avatar need none: the
// bubble already says who is talking. The diarizer's
// reference clip is this avatar's voice. On a personal avatar that is also
// the user's voice, so a raw speaker name of the avatar on a human turn is
// the person, not a third party. On any other avatar the same name is who is
// being spoken to — still the person on a human turn, never a label.

import { speakerIdentityOf } from './speakerIdentity.js';

export const SPEAKER_ROLE_USER = 'user';
export const SPEAKER_ROLE_AVATAR = 'avatar';
export const SPEAKER_ROLE_OTHER = 'other';
// Sound that is nobody talking — a television in the next room, laughter, a
// door. Not a speaker, so it gets no name and no animal: giving ambience an
// identity turns the room itself into a participant in the conversation.
export const SPEAKER_ROLE_SCENE = 'scene';

function flag(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function namesMatch(left, right) {
  const a = String(left ?? '').trim().toLowerCase();
  const b = String(right ?? '').trim().toLowerCase();
  return Boolean(a) && a === b;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The API's plain-text script names each speaker. On a human turn that name
 * is often this avatar — the one being spoken to — which the bubble already
 * is not: the person is "You". Strip a leading `Name:` only when the first
 * line is that labelled script.
 *
 * @param {string} text
 * @param {string} [avatarName]
 * @returns {string}
 */
export function withoutAddressedAvatarPrefix(text, avatarName = '') {
  const name = String(avatarName ?? '').trim();
  const body = String(text ?? '');
  if (!name || !body) return body;
  const prefixPattern = new RegExp(`^${escapeRegExp(name)}:\\s*`, 'i');
  const lines = body.split('\n');
  const first = lines.find((line) => line.trim());
  if (!first || !prefixPattern.test(first.trim())) return body;
  return lines
    .map((line) => {
      const trimmed = line.trimStart();
      return prefixPattern.test(trimmed)
        ? trimmed.replace(prefixPattern, '')
        : line;
    })
    .join('\n')
    .trim();
}

/**
 * Which of the roles a segment is.
 *
 * Sound that is not speech is settled first: it is not any of the people.
 * After that the owner always wins. Matching the avatar's voice on a human
 * turn is the person speaking, not the avatar answering: those clips are
 * compared against the same reference audio.
 *
 * @param {Object} segment
 * @param {Object} [options]
 * @param {boolean} [options.humanTurn] This segment sits on a human message.
 * @param {string} [options.avatarName]
 * @returns {'user'|'avatar'|'other'}
 */
export function speakerRoleOf(segment, { humanTurn = false, avatarName = '' } = {}) {
  if (flag(segment?.is_scene) || flag(segment?.isScene)) {
    return SPEAKER_ROLE_SCENE;
  }
  if (flag(segment?.is_owner) || flag(segment?.isOwner)) {
    return SPEAKER_ROLE_USER;
  }
  const namedAsAvatar = namesMatch(segment?.speaker, avatarName);
  const matchedAvatar = flag(segment?.is_avatar) || flag(segment?.isAvatar);
  if (matchedAvatar || namedAsAvatar) {
    return humanTurn ? SPEAKER_ROLE_USER : SPEAKER_ROLE_AVATAR;
  }
  return SPEAKER_ROLE_OTHER;
}

/**
 * Display name for a third-party voice, or for ambience. User and avatar lines
 * stay unlabelled: the bubble already says who is talking.
 *
 * @param {'user'|'avatar'|'other'} role
 * @param {Object} [options]
 * @param {string} [options.speaker]
 * @returns {string}
 */
export function speakerLabelOf(role, { speaker = '' } = {}) {
  // Ambience is named for what it is, in the one place a label appears at all.
  if (role === SPEAKER_ROLE_SCENE) return 'background';
  if (role !== SPEAKER_ROLE_OTHER) return '';
  return speakerIdentityOf(speaker).name;
}

/**
 * Merge consecutive segments of one role into single lines.
 *
 * @param {Array<{speaker: string, text: string, is_owner?: boolean, is_avatar?: boolean}>} segments
 * @param {Object} [options]
 * @param {boolean} [options.humanTurn]
 * @param {string} [options.avatarName]
 * @returns {Array<{speaker: string, label: string, text: string, role: string, identity: Object|null, isOwner: boolean, isAvatar: boolean}>}
 */
export function speakerLinesOf(segments, options = {}) {
  const lines = [];
  for (const segment of segments ?? []) {
    const text = String(segment?.text ?? '').trim();
    if (!text) continue;
    const speaker = String(segment?.speaker ?? '').trim() || 'Speaker';
    const role = speakerRoleOf(segment, options);
    const identity =
      role === SPEAKER_ROLE_OTHER ? speakerIdentityOf(speaker) : null;
    const label = speakerLabelOf(role, { speaker });
    const last = lines[lines.length - 1];
    if (last && last.role === role && last.label === label) {
      last.text = `${last.text} ${text}`;
    } else {
      lines.push({
        speaker,
        label,
        text,
        role,
        identity,
        isOwner: role === SPEAKER_ROLE_USER,
        isAvatar: role === SPEAKER_ROLE_AVATAR,
      });
    }
  }
  return lines;
}

/**
 * Caption / flash text: third-party lines keep their name, others do not.
 *
 * @param {Array<{speaker: string, text: string, is_owner?: boolean, is_avatar?: boolean}>} segments
 * @param {Object} [options]
 * @returns {string}
 */
export function speakerCaptionText(segments, options = {}) {
  return speakerLinesOf(segments, options)
    .map((line) => (line.label ? `${line.label}: ${line.text}` : line.text))
    .join('\n');
}

/**
 * Whether a message carries a speaker-labelled transcript worth rendering.
 *
 * @param {Object} message
 * @returns {boolean}
 */
export function hasSpeakerScript(message) {
  return Array.isArray(message?.speakers?.segments) && message.speakers.segments.length > 0;
}

/**
 * Whether the transcript should split overheard voices onto their own
 * bubbles: only when someone other than the person or this avatar spoke.
 *
 * @param {Object} message
 * @param {Object} [options]
 * @param {boolean} [options.humanTurn]
 * @param {string} [options.avatarName]
 * @returns {boolean}
 */
export function hasThirdPartySpeakerScript(message, options = {}) {
  if (!hasSpeakerScript(message)) return false;
  return speakerLinesOf(message.speakers.segments, options).some(
    (line) => line.role === SPEAKER_ROLE_OTHER
  );
}

/**
 * The bubbles to paint for a mixed spoken turn, or null when the turn is
 * only the person (ordinary single bubble).
 *
 * @param {Object} message
 * @param {Object} [options]
 * @returns {Array|null}
 */
export function speakerBubbleRowsOf(message, options = {}) {
  if (!hasThirdPartySpeakerScript(message, options)) return null;
  return speakerLinesOf(message.speakers.segments, options);
}

/**
 * Words to show, copy, or edit for a spoken turn. User and avatar lines stay
 * unlabelled: the diarizer's script names this avatar on the person's turn.
 *
 * @param {Object} [message]
 * @param {Object} [options]
 * @param {boolean} [options.humanTurn]
 * @param {string} [options.avatarName]
 * @returns {string}
 */
export function spokenTurnText(message, options = {}) {
  if (hasSpeakerScript(message)) {
    const fromSpeakers = speakerCaptionText(message.speakers.segments, options);
    if (fromSpeakers.trim()) return fromSpeakers;
  }
  return withoutAddressedAvatarPrefix(
    contentAsPlainText(message?.content),
    options.avatarName
  );
}

/**
 * Plain text for edit / copy / retry. Stored turns are strings; a live
 * spoken turn may carry LangChain content blocks or only speaker segments.
 *
 * @param {Object} [message]
 * @param {Object} [options]
 * @param {boolean} [options.humanTurn]
 * @param {string} [options.avatarName]
 * @returns {string}
 */
export function editableScriptText(message, options = {}) {
  const fromSpoken = spokenTurnText(message, {
    humanTurn: options.humanTurn ?? true,
    avatarName: options.avatarName ?? '',
  });
  if (fromSpoken.trim()) return fromSpoken;
  return contentAsPlainText(message?.content);
}

function contentAsPlainText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part) => {
      if (typeof part === 'string') return part;
      if (part && typeof part === 'object' && typeof part.text === 'string') {
        return part.text;
      }
      return '';
    })
    .join('');
}
