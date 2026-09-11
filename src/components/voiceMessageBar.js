const KEEP_MESSAGE_BAR_OPEN =
  '[data-voice-message-bar], [data-voice-mute-bar], [data-voice-camera-bar], [data-voice-stage-header], [data-voice-caption-dock]';

const KEEP_MESSAGE_BAR_OPEN_CONTROL =
  'button, input, textarea, select, a, [role="menu"], [role="menuitem"], [role="dialog"]';

/**
 * Whether a pointer on the voice stage should fold the message bar.
 *
 * The bar, the mute indicators, the header, the caption dock, and any
 * control stay put.
 * Everything else is empty stage.
 *
 * @param {EventTarget|null|undefined} target
 * @returns {boolean}
 */
export function shouldCollapseVoiceMessageBar(target) {
  if (!target || typeof target.closest !== 'function') return true;
  if (target.closest(KEEP_MESSAGE_BAR_OPEN)) return false;
  if (target.closest(KEEP_MESSAGE_BAR_OPEN_CONTROL)) return false;
  return true;
}

/**
 * Whether the folded message bar should wear the speak glow.
 *
 * That glow is the person's turn — live listening heard speech, or they are
 * still holding a dictation — not the avatar speaking on the portrait.
 *
 * @param {Object} [state]
 * @param {boolean} [state.hearingSpeech]
 * @param {boolean} [state.dictating]
 * @returns {boolean}
 */
export function collapsedVoiceBarIsSpeaking({
  hearingSpeech = false,
  dictating = false,
} = {}) {
  return Boolean(hearingSpeech || dictating);
}

/**
 * Whether the voice message bar is holding a file that must stay visible.
 *
 * Folding the bar would hide the only preview of a waiting attachment, or of
 * one already on its way.
 *
 * @param {Object} [state]
 * @param {number} [state.mediaFileCount]
 * @param {number} [state.inFlightCount]
 * @returns {boolean}
 */
export function voiceMessageBarHasDraftAttachments({
  mediaFileCount = 0,
  inFlightCount = 0,
} = {}) {
  return Number(mediaFileCount) > 0 || Number(inFlightCount) > 0;
}

/**
 * How the optional camera cluster and the message chrome share a row.
 *
 * Camera controls sit at the foot of the composer. Without them this is
 * still `items-end` so a lone message bar does not stretch oddly.
 *
 * @param {boolean} [_isCollapsed]
 * @returns {'items-end'}
 */
export function voiceComposerDockItemsClass(_isCollapsed) {
  return 'items-end';
}
