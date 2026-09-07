// Document Picture-in-Picture: an always-on-top window the OS can move, so
// the Evan pill stays visible over other apps. Chrome and Edge support this.
// Firefox and Safari do not; those browsers keep the pill in the tab.
// The control is gated off until that window hosts a working help chat.

/** Off until the floating window hosts a working help chat. */
export const EVAN_ASSIST_DESKTOP_POPOUT_ENABLED = false;

/**
 * Whether this browser can float the assistant over other applications.
 *
 * @param {typeof globalThis} [globalObject]
 * @returns {boolean}
 */
export function canFloatAssistOnDesktop(globalObject = globalThis) {
  return (
    typeof globalObject?.documentPictureInPicture?.requestWindow === 'function'
  );
}

/**
 * Whether the overlay should offer the desktop pop-out control.
 *
 * @param {typeof globalThis} [globalObject]
 * @returns {boolean}
 */
export function canOfferAssistDesktopPopout(globalObject = globalThis) {
  return (
    EVAN_ASSIST_DESKTOP_POPOUT_ENABLED && canFloatAssistOnDesktop(globalObject)
  );
}

/**
 * Copy the opener's stylesheets into the desktop window so Tailwind classes
 * still resolve after the panel is portaled out of the tab.
 *
 * @param {Document|null|undefined} sourceDocument
 * @param {Document|null|undefined} targetDocument
 * @returns {number} How many nodes were copied.
 */
export function copyStylesIntoDocument(sourceDocument, targetDocument) {
  if (!sourceDocument || !targetDocument?.head) return 0;
  let copied = 0;
  const nodes = sourceDocument.querySelectorAll?.(
    'link[rel="stylesheet"], style'
  );
  if (!nodes) return 0;
  for (const node of nodes) {
    targetDocument.head.appendChild(
      typeof node.cloneNode === 'function' ? node.cloneNode(true) : node
    );
    copied += 1;
  }
  if (sourceDocument.documentElement && targetDocument.documentElement) {
    targetDocument.documentElement.className =
      sourceDocument.documentElement.className;
  }
  return copied;
}

/**
 * @param {Document|null|undefined} targetDocument
 */
export function decorateDesktopDocument(targetDocument) {
  if (!targetDocument?.documentElement || !targetDocument.body) return;
  targetDocument.documentElement.style.height = '100%';
  targetDocument.documentElement.style.background = '#000000';
  targetDocument.body.style.margin = '0';
  targetDocument.body.style.height = '100%';
  targetDocument.body.style.background = '#000000';
  targetDocument.body.style.overflow = 'hidden';
}

/**
 * Open a Picture-in-Picture window sized to the pill or the expanded chat.
 *
 * @param {{width: number, height: number}} size
 * @param {Object} [options]
 * @param {{requestWindow: Function}|null} [options.pictureInPicture]
 * @param {Document|null} [options.sourceDocument]
 * @returns {Promise<Window>}
 */
export async function openAssistDesktopWindow(
  size,
  {
    pictureInPicture = globalThis.documentPictureInPicture,
    sourceDocument = globalThis.document,
  } = {}
) {
  if (typeof pictureInPicture?.requestWindow !== 'function') {
    const error = new Error(
      'This browser cannot keep the assistant on the desktop.'
    );
    error.name = 'NotSupportedError';
    throw error;
  }
  const pipWindow = await pictureInPicture.requestWindow({
    width: Math.max(1, Math.round(size?.width ?? 0)),
    height: Math.max(1, Math.round(size?.height ?? 0)),
  });
  copyStylesIntoDocument(sourceDocument, pipWindow.document);
  decorateDesktopDocument(pipWindow.document);
  return pipWindow;
}

/**
 * @param {Window|null|undefined} pipWindow
 * @param {{width: number, height: number}} size
 */
export function resizeAssistDesktopWindow(pipWindow, size) {
  if (!pipWindow || pipWindow.closed) return;
  if (typeof pipWindow.resizeTo !== 'function') return;
  pipWindow.resizeTo(
    Math.max(1, Math.round(size?.width ?? 0)),
    Math.max(1, Math.round(size?.height ?? 0))
  );
}

/**
 * @param {Window|null|undefined} pipWindow
 */
export function closeAssistDesktopWindow(pipWindow) {
  if (!pipWindow || pipWindow.closed) return;
  try {
    pipWindow.close();
  } catch {
    // The opener is allowed to close a document PiP window it created.
  }
}
