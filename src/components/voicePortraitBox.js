/**
 * Where the voice-stage portrait actually paints, and the speak glow and
 * standing frame that sit on that video — the same aspect ratio as the still
 * or clip, not a circle.
 */

/**
 * Intrinsic pixel size of a video, still, or idle-loop canvas.
 *
 * @param {HTMLVideoElement|HTMLImageElement|HTMLCanvasElement|null|undefined} element
 * @returns {{width: number, height: number}|null}
 */
export function mediaIntrinsicSize(element) {
  if (!element) return null;
  const tag = element.tagName;
  if (tag === 'VIDEO') {
    const width = element.videoWidth;
    const height = element.videoHeight;
    if (width > 0 && height > 0) return { width, height };
    return null;
  }
  if (tag === 'IMG') {
    const width = element.naturalWidth;
    const height = element.naturalHeight;
    if (width > 0 && height > 0) return { width, height };
    return null;
  }
  if (tag === 'CANVAS') {
    const width = element.width;
    const height = element.height;
    if (width > 0 && height > 0) return { width, height };
  }
  return null;
}

/**
 * The box `object-fit: contain` uses inside a well.
 *
 * @param {number} wellWidth
 * @param {number} wellHeight
 * @param {number} [mediaWidth]
 * @param {number} [mediaHeight]
 * @returns {{x: number, y: number, width: number, height: number}}
 */
export function objectContainBox(
  wellWidth,
  wellHeight,
  mediaWidth,
  mediaHeight
) {
  if (!(wellWidth > 0) || !(wellHeight > 0)) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  if (!(mediaWidth > 0) || !(mediaHeight > 0)) {
    return { x: 0, y: 0, width: wellWidth, height: wellHeight };
  }
  const wellRatio = wellWidth / wellHeight;
  const mediaRatio = mediaWidth / mediaHeight;
  if (mediaRatio > wellRatio) {
    const width = wellWidth;
    const height = wellWidth / mediaRatio;
    return { x: 0, y: (wellHeight - height) / 2, width, height };
  }
  const height = wellHeight;
  const width = wellHeight * mediaRatio;
  return { x: (wellWidth - width) / 2, y: 0, width, height };
}

/**
 * The media layer currently shown in the portrait. An incoming face that
 * is still decoding stays in the DOM at opacity 0.
 *
 * @param {Element|null|undefined} root
 * @returns {Element|null}
 */
export function paintedMediaIn(root) {
  const nodes = [...(root?.querySelectorAll?.('video, canvas, img') ?? [])];
  if (nodes.length === 0) return null;
  const shown = nodes.filter((node) => !node.classList?.contains('opacity-0'));
  return shown.at(-1) ?? nodes.at(-1) ?? null;
}

/**
 * Media node LoopingVideo's `onPresented` payload can size the well from.
 *
 * `{ src, poster }` is not a DOM node. Passing that object through as the
 * painted media left `mediaIntrinsicSize` empty, so the well snapped to a
 * square until the next layout pass read the loop.
 *
 * @param {HTMLVideoElement|HTMLImageElement|HTMLCanvasElement|{src?: string, poster?: string}|null|undefined} presented
 * @returns {HTMLVideoElement|HTMLImageElement|HTMLCanvasElement|null}
 */
export function presentedStageMedia(presented) {
  if (!presented) return null;
  if (typeof presented.tagName === 'string') return presented;
  return null;
}

const DEFAULT_CANVAS_WIDTH = 300;
const DEFAULT_CANVAS_HEIGHT = 150;

function isUnpaintedCanvas(element) {
  return (
    element?.tagName === 'CANVAS' &&
    element.width === DEFAULT_CANVAS_WIDTH &&
    element.height === DEFAULT_CANVAS_HEIGHT
  );
}

/**
 * The media whose aspect ratio the voice-stage well should match.
 *
 * Generated idle loops are 9:16 painted over a square still. Sizing the well
 * to an unpainted 300×150 canvas put the face in a tiny window. Once the
 * loop (or clip) has a real size, the well matches that portrait so the
 * whole generated picture is on stage, contained and centered.
 *
 * @param {Element|null|undefined} root
 * @returns {Element|null}
 */
export function portraitWellMediaIn(root) {
  const nodes = [...(root?.querySelectorAll?.('video, canvas, img') ?? [])];
  if (nodes.length === 0) return null;
  const shown = nodes.filter((node) => !node.classList?.contains('opacity-0'));
  const pool = shown.length > 0 ? shown : nodes;
  const sized = [...pool]
    .reverse()
    .filter((node) => mediaIntrinsicSize(node) && !isUnpaintedCanvas(node));
  const motion = sized.find(
    (node) => node.tagName === 'VIDEO' || node.tagName === 'CANVAS'
  );
  if (motion) return motion;
  return sized[0] ?? null;
}

const rememberedPortraitWellByAssistant = new Map();

/**
 * How close two width/height ratios must be to count as the same shape.
 * Square stills sit at 1; generated loops sit at 9/16 (0.5625).
 */
const PORTRAIT_WELL_ASPECT_SLACK = 0.08;

/**
 * @param {{width?: number, height?: number}|null|undefined} size
 * @returns {number|null}
 */
export function portraitWellAspectRatio(size) {
  if (!(size?.width > 0) || !(size?.height > 0)) return null;
  return size.width / size.height;
}

/**
 * @param {{width?: number, height?: number}|null|undefined} size
 * @returns {boolean}
 */
export function portraitWellIsSquare(size) {
  const ratio = portraitWellAspectRatio(size);
  if (ratio == null) return false;
  return Math.abs(ratio - 1) <= PORTRAIT_WELL_ASPECT_SLACK;
}

/**
 * Generated gallery cards and idle loops are 9:16, taller than wide.
 *
 * @param {{width?: number, height?: number}|null|undefined} size
 * @returns {boolean}
 */
export function portraitWellIsTall(size) {
  const ratio = portraitWellAspectRatio(size);
  if (ratio == null) return false;
  return ratio <= 9 / 16 + PORTRAIT_WELL_ASPECT_SLACK;
}

/**
 * @param {{width?: number, height?: number}|null|undefined} size
 * @returns {boolean}
 */
export function portraitWellSizeIsUsable(size) {
  return Boolean(size?.width > 0 && size?.height > 0);
}

/**
 * @param {{width?: number, height?: number}|null|undefined} left
 * @param {{width?: number, height?: number}|null|undefined} right
 * @returns {boolean}
 */
export function portraitWellSizesEqual(left, right) {
  if (!portraitWellSizeIsUsable(left) && !portraitWellSizeIsUsable(right)) {
    return true;
  }
  if (!portraitWellSizeIsUsable(left) || !portraitWellSizeIsUsable(right)) {
    return false;
  }
  return left.width === right.width && left.height === right.height;
}

export function portraitWellAspectsAgree(left, right) {
  const leftRatio = portraitWellAspectRatio(left);
  const rightRatio = portraitWellAspectRatio(right);
  if (leftRatio == null || rightRatio == null) return false;
  return Math.abs(leftRatio - rightRatio) <= PORTRAIT_WELL_ASPECT_SLACK;
}

/**
 * Store the voice-stage well so a remount can open at the same size.
 *
 * Leaving for Avatar Selection used to destroy the stage. The first paint
 * then used a square the size of the gallery disc, and the clip snapped the
 * portrait to 9:16 a moment later.
 *
 * @param {string|null|undefined} assistantId
 * @param {{width: number, height: number}|null|undefined} size
 */
export function rememberPortraitWellSize(assistantId, size) {
  if (!assistantId) return;
  if (!(size?.width > 0) || !(size?.height > 0)) return;
  rememberedPortraitWellByAssistant.set(assistantId, {
    width: size.width,
    height: size.height,
  });
}

/**
 * Last well size stored for this avatar, if any.
 *
 * @param {string|null|undefined} assistantId
 * @returns {{width: number, height: number}|null}
 */
export function recalledPortraitWellSize(assistantId) {
  if (!assistantId) return null;
  return rememberedPortraitWellByAssistant.get(assistantId) ?? null;
}

/**
 * Remember a portrait aspect the first time this avatar is opened, or
 * replace a square recall that came from the generated still.
 *
 * The gallery already knows generated cards are 9:16. Without this, the
 * voice well starts as a square and snaps when the loop reports its size.
 *
 * @param {string|null|undefined} assistantId
 * @param {number} aspectWidth
 * @param {number} aspectHeight
 */
export function seedPortraitWellAspectIfUnknown(
  assistantId,
  aspectWidth,
  aspectHeight
) {
  if (!assistantId) return;
  if (!(aspectWidth > 0) || !(aspectHeight > 0)) return;
  const existing = recalledPortraitWellSize(assistantId);
  // A square recall is the generated still, not the loop. Keep a measured
  // 9:16 well; replace the square so opening chat does not start as a disc.
  if (existing && !portraitWellIsSquare(existing)) return;
  rememberPortraitWellSize(assistantId, {
    width: aspectWidth,
    height: aspectHeight,
  });
}

/**
 * Whether the voice well should keep the outgoing avatar's size for this
 * paint.
 *
 * Switching avatars paints the incoming still first. That still is square,
 * so sizing the well to the still turns the portrait into a circle, then the
 * idle loop snaps the well to 9:16 — the hop. Hold the outgoing size until
 * the painted media matches the incoming well's aspect.
 *
 * @param {{width?: number, height?: number}|null|undefined} outgoingSize
 * @param {{width?: number, height?: number}|null|undefined} incomingSize
 * @param {{width?: number, height?: number}|null|undefined} paintedIntrinsic
 * @returns {boolean}
 */
export function portraitWellShouldHoldOutgoingSize(
  outgoingSize,
  incomingSize,
  paintedIntrinsic
) {
  if (!portraitWellSizeIsUsable(outgoingSize)) return false;
  if (!portraitWellSizeIsUsable(incomingSize)) return false;
  if (portraitWellAspectsAgree(outgoingSize, incomingSize)) return false;
  if (
    portraitWellIsTall(outgoingSize) &&
    portraitWellIsSquare(incomingSize) &&
    !portraitWellIsTall(paintedIntrinsic)
  ) {
    return true;
  }
  return false;
}

/**
 * Where the standing hairline and speak glow sit: the painted photograph,
 * not the letterbox a square still leaves in a 9:16 well.
 *
 * The well can stay 9:16 so a generated loop has a home. The previous
 * border sat on the face. Only the glass colour changed.
 *
 * @param {{width?: number, height?: number}|null|undefined} wellSize
 * @param {HTMLVideoElement|HTMLImageElement|HTMLCanvasElement|null|undefined} media
 * @returns {{x: number, y: number, width: number, height: number, circle: boolean}}
 */
export function paintedPortraitFrameFor(wellSize, media) {
  const wellWidth = Number(wellSize?.width);
  const wellHeight = Number(wellSize?.height);
  if (!(wellWidth > 0) || !(wellHeight > 0)) {
    return { x: 0, y: 0, width: 0, height: 0, circle: true };
  }
  const intrinsic = mediaIntrinsicSize(media);
  const box = objectContainBox(
    wellWidth,
    wellHeight,
    intrinsic?.width,
    intrinsic?.height
  );
  return {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    circle: portraitWellIsSquare(box),
  };
}

/**
 * Largest box of the media's aspect ratio that fits in `constraint`.
 * Before the still or clip reports a size, a remembered well keeps the last
 * aspect so the face does not reopen as the gallery's square. With nothing
 * remembered, a square so the stage still has a portrait.
 *
 * The well sits inside the constraint's padding, so the fit uses the content
 * box. Sizing from `clientWidth` (padding included) then letting `max-width:
 * 100%` shrink only the width left a tall non-square portrait.
 *
 * @param {Element|null|undefined} constraint
 * @param {Element|null|undefined} media
 * @param {{width: number, height: number}|null|undefined} [rememberedSize]
 * @returns {{width: number, height: number}|null}
 */
export function portraitWellSizeForConstraint(constraint, media, rememberedSize) {
  if (!constraint) return null;
  const box = constraintContentSize(constraint);
  if (!box) return null;
  const { width, height } = box;
  const intrinsic = mediaIntrinsicSize(media);
  // The stage can still hold the previous avatar's still or loop for a
  // paint. Trust a remembered aspect until the media on stage matches that
  // aspect — a square generated still must not snap a 9:16 well, and a
  // leftover 9:16 loop must not snap a square portrait.
  if (rememberedSize?.width > 0 && rememberedSize?.height > 0) {
    const mediaMatchesRemembered =
      intrinsic && portraitWellAspectsAgree(intrinsic, rememberedSize);
    if (!mediaMatchesRemembered) {
      const contained = objectContainBox(
        width,
        height,
        rememberedSize.width,
        rememberedSize.height
      );
      return { width: contained.width, height: contained.height };
    }
  }
  if (!(intrinsic?.width > 0) || !(intrinsic?.height > 0)) {
    const size = Math.min(width, height);
    return { width: size, height: size };
  }
  const contained = objectContainBox(
    width,
    height,
    intrinsic.width,
    intrinsic.height
  );
  return { width: contained.width, height: contained.height };
}

/**
 * @param {Element|{clientWidth?: number, clientHeight?: number}|null|undefined} constraint
 * @returns {{width: number, height: number}|null}
 */
export function constraintContentSize(constraint) {
  const width = Number(constraint?.clientWidth);
  const height = Number(constraint?.clientHeight);
  if (!(width > 0) || !(height > 0)) return null;
  try {
    if (typeof getComputedStyle === 'function' && constraint.nodeType) {
      const style = getComputedStyle(constraint);
      const contentWidth =
        width -
        (Number.parseFloat(style.paddingLeft) || 0) -
        (Number.parseFloat(style.paddingRight) || 0);
      const contentHeight =
        height -
        (Number.parseFloat(style.paddingTop) || 0) -
        (Number.parseFloat(style.paddingBottom) || 0);
      if (contentWidth > 0 && contentHeight > 0) {
        return { width: contentWidth, height: contentHeight };
      }
    }
  } catch {
    // Test doubles have no computed style.
  }
  return { width, height };
}

/**
 * Extra gap so the portrait does not kiss the frosted header or message dock.
 */
export const PORTRAIT_CHROME_GUTTER_PX = 16;

/**
 * The suggested-replies list inside the voice message dock. Expanding that
 * list must not change the portrait size, so chrome padding subtracts it.
 */
export const VOICE_SUGGESTION_SHEET_SELECTOR = '[data-voice-suggestion-sheet]';

/**
 * How tall the open suggestion list is inside the voice message dock.
 *
 * @param {Element|null|undefined} dock
 * @returns {number}
 */
export function suggestionSheetHeightIn(dock) {
  const sheet = dock?.querySelector?.(VOICE_SUGGESTION_SHEET_SELECTOR);
  if (!sheet || sheet.hidden) return 0;
  const height = Number(sheet.getBoundingClientRect?.().height);
  let margin = 0;
  try {
    if (typeof getComputedStyle === 'function' && sheet.nodeType) {
      const style = getComputedStyle(sheet);
      margin =
        (Number.parseFloat(style.marginTop) || 0) +
        (Number.parseFloat(style.marginBottom) || 0);
    }
  } catch {
    // Test doubles have no computed style.
  }
  const total = (Number.isFinite(height) && height > 0 ? height : 0) + margin;
  return total > 0 ? total : 0;
}

const rememberedPortraitChromeByAssistant = new Map();

/**
 * Store header and folded-handle heights so a remount opens with the same
 * chrome padding the last visible stage used.
 *
 * @param {string|null|undefined} assistantId
 * @param {{headerHeight?: number, collapsedDockHeight?: number}|null|undefined} chrome
 */
export function rememberPortraitChrome(assistantId, chrome) {
  if (!assistantId) return;
  const headerHeight = Number(chrome?.headerHeight);
  const collapsedDockHeight = Number(chrome?.collapsedDockHeight);
  const previous = rememberedPortraitChromeByAssistant.get(assistantId) ?? {};
  const nextHeader = headerHeight > 0 ? headerHeight : previous.headerHeight;
  const nextCollapsed =
    collapsedDockHeight > 0
      ? collapsedDockHeight
      : previous.collapsedDockHeight;
  if (!(nextHeader > 0) && !(nextCollapsed > 0)) return;
  rememberedPortraitChromeByAssistant.set(assistantId, {
    headerHeight: nextHeader,
    collapsedDockHeight: nextCollapsed,
  });
}

/**
 * Last chrome padding stored for this avatar, if any.
 *
 * @param {string|null|undefined} assistantId
 * @returns {{headerHeight?: number, collapsedDockHeight?: number}|null}
 */
export function recalledPortraitChrome(assistantId) {
  if (!assistantId) return null;
  return rememberedPortraitChromeByAssistant.get(assistantId) ?? null;
}

/**
 * Height reserved under the portrait for the folded Message handle.
 *
 * The open composer and suggested replies may cover the lower portrait.
 * Only the folded handle must sit below the face, so expanding the message
 * area must not change this reserve.
 *
 * @param {Object} parameters
 * @param {number} [parameters.collapsedDockHeight]
 * @param {number} [parameters.lastCollapsedReserveHeight]
 * @returns {number}
 */
export function portraitComposerReserveHeight({
  collapsedDockHeight,
  lastCollapsedReserveHeight = 0,
} = {}) {
  const collapsed = Number(collapsedDockHeight);
  if (Number.isFinite(collapsed) && collapsed > 0) {
    return collapsed;
  }
  const remembered = Number(lastCollapsedReserveHeight);
  if (Number.isFinite(remembered) && remembered > 0) {
    return remembered;
  }
  return 0;
}

/**
 * Padding that keeps the voice-stage well in the open stage, below the
 * workspace tabs and above the message bar. Uniform `p-6` was shorter than
 * that chrome, so a 9:16 portrait put the head under the frost.
 *
 * @param {number} [headerHeight]
 * @param {number} [composerHeight]
 * @param {number} [gutter]
 * @returns {{paddingTop: number, paddingBottom: number}}
 */
export function portraitChromePadding(
  headerHeight,
  composerHeight,
  gutter = PORTRAIT_CHROME_GUTTER_PX
) {
  const safeGutter = Number.isFinite(gutter) && gutter > 0 ? gutter : 0;
  const top = Number(headerHeight);
  const bottom = Number(composerHeight);
  return {
    paddingTop: (Number.isFinite(top) && top > 0 ? top : 0) + safeGutter,
    paddingBottom:
      (Number.isFinite(bottom) && bottom > 0 ? bottom : 0) + safeGutter,
  };
}
