// src/components/voiceCaptionVisibility.js
//
// Voice-mode captions must not show the finished reply until the talking
// face is on stage. Otherwise the line appears, then the lip-sync clip
// lands a few seconds later.

const isAvatarLike = (message) => {
  const type = message?.type || message?.sender;
  return type === 'ai' || type === 'assistant' || type === 'avatar';
};

/**
 * What the caption dock should paint for one turn.
 *
 * Human lines always show. A pending avatar line stays as typing dots.
 * A finished avatar line stays as typing dots until it has been revealed
 * (the clip — or the emotion loop, when there is no clip — is on stage).
 *
 * @param {Object} message A transcript turn.
 * @param {Object} options
 * @param {boolean} options.holdNewCaptions Whether a reply is still being staged.
 * @param {Set<string>} options.revealedIds Avatar message ids that may show their words.
 * @returns {Object|null} The message to render, or null to hide it.
 */
export function captionForVoiceStage(message, { holdNewCaptions, revealedIds }) {
  if (!message) return null;
  if (!isAvatarLike(message)) return message;
  if (message.isLoading || message.isPending) return message;
  if (!holdNewCaptions) return message;
  if (message.id && revealedIds.has(message.id)) return message;
  return { ...message, isLoading: true, content: '' };
}

/**
 * Whether a stage `onPresented` event is the talking clip we are waiting for.
 * The emotion loop can finish decoding first; that must not release the line.
 *
 * @param {Object} [presented] `{src, poster}` from LoopingVideo.
 * @param {string} clipUrl The lip-sync clip we just put on the stage.
 * @returns {boolean}
 */
export function stagePresentationIsClip(presented, clipUrl) {
  return Boolean(clipUrl) && presented?.src === clipUrl;
}
