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
 * Whether this caption is the reply still being generated.
 *
 * Typing dots or a pending bubble, or the live row whose tokens are still
 * arriving (`streamingText`). The stream stays open after the words are
 * done — keepalives run post-reply analysis — and the `streaming-*` id is
 * kept after `done`, so neither the open request nor the prefix means Stop
 * still belongs here. Once `streamingText` is false the original buttons
 * come back even if the turn is still on the wire.
 *
 * @param {Object|null|undefined} message
 * @param {Object} [options]
 * @param {boolean} [options.turnActive] Force Stop off when the text turn ended.
 * @returns {boolean}
 */
export function voiceMessageIsGenerating(message, { turnActive = true } = {}) {
  if (!message || !isAvatarLike(message) || !turnActive) return false;
  if (message.streamingText === false) return false;
  if (message.isLoading || message.isPending) return true;
  return message.streamingText === true;
}

/**
 * Whether any caption in the exchange is still growing its text.
 *
 * @param {Array<Object|null|undefined>|null|undefined} messages
 * @returns {boolean}
 */
export function voiceExchangeHasGeneratingText(messages) {
  return (messages ?? []).some((message) => voiceMessageIsGenerating(message));
}

/**
 * Whether a caption-hidden stage should paint a line.
 *
 * A folded message bar is a clean stage: if the avatar can be heard and
 * captions are off, there is nothing to read. Mute is one exception — the
 * words have to appear or the reply is lost. No voice model is the other:
 * there is never audio, so the line stays up regardless of fold or mute.
 *
 * @param {Object} [state]
 * @param {boolean} [state.messageBarCollapsed]
 * @param {boolean} [state.captionsShown]
 * @param {boolean} [state.avatarMuted]
 * @param {boolean} [state.hasVoiceModel] Whether this avatar can speak here.
 * @returns {boolean}
 */
export function shouldShowVoiceStageText({
  messageBarCollapsed = false,
  captionsShown = false,
  avatarMuted = false,
  hasVoiceModel = true,
} = {}) {
  if (captionsShown) return false;
  if (!hasVoiceModel) return true;
  if (!messageBarCollapsed) return true;
  return Boolean(avatarMuted);
}

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
