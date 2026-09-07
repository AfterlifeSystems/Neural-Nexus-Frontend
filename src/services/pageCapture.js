// src/services/pageCapture.js
//
// Render the Neural Nexus page itself to an image, without a screen-share
// picker: html2canvas walks the document and paints the page onto a canvas,
// so no browser permission is asked and nothing outside this page is ever
// seen. The library is loaded on first use so a missing package breaks only
// capture, never the application (a CSS import that failed once unstyled the
// whole application; see the repository notes).
//
// Anything a person types into a password field, and any element marked
// `data-usage-analytics-mask`, is left out of the rendering.

/** The attribute that hides an element from every capture. */
export const CAPTURE_MASK_ATTRIBUTE = 'data-usage-analytics-mask';

/** Longest edge of the image sent to the API. Larger costs more and adds nothing. */
export const CAPTURE_MAX_WIDTH = 1280;

let html2canvasPromise = null;

function loadHtml2Canvas() {
  if (!html2canvasPromise) {
    html2canvasPromise = import('html2canvas')
      .then((module) => module.default ?? module)
      .catch((loadError) => {
        html2canvasPromise = null;
        throw loadError;
      });
  }
  return html2canvasPromise;
}

/**
 * Whether an element must be left out of a capture.
 *
 * @param {Element} element
 * @returns {boolean}
 */
export function shouldMaskElement(element) {
  if (!element || typeof element.getAttribute !== 'function') return false;
  if (element.hasAttribute?.(CAPTURE_MASK_ATTRIBUTE)) return true;
  const tag = String(element.tagName ?? '').toLowerCase();
  if (tag === 'input') {
    const type = String(element.getAttribute('type') ?? 'text').toLowerCase();
    return type === 'password';
  }
  return false;
}

/**
 * Whether this browser can render the page to a canvas.
 *
 * @returns {boolean}
 */
export function canCapturePage() {
  return (
    typeof document !== 'undefined' &&
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.toBlob === 'function'
  );
}

/**
 * Render the page and return a JPEG of the rendering.
 *
 * @param {Object} [options]
 * @param {number} [options.maxWidth] Longest width of the image.
 * @param {number} [options.quality] JPEG quality, 0 to 1.
 * @returns {Promise<Blob>}
 */
export async function capturePage({ maxWidth = CAPTURE_MAX_WIDTH, quality = 0.7 } = {}) {
  if (!canCapturePage()) {
    const error = new Error('This browser cannot render the page to an image.');
    error.name = 'NotSupportedError';
    throw error;
  }
  const html2canvas = await loadHtml2Canvas();
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const scale = Math.min(1, maxWidth / Math.max(1, viewportWidth));
  const canvas = await html2canvas(document.body, {
    // The viewport, not the whole scrollable document: what the person sees.
    width: viewportWidth,
    height: viewportHeight,
    x: window.scrollX,
    y: window.scrollY,
    scale,
    backgroundColor: '#000000',
    logging: false,
    useCORS: true,
    // Images the canvas cannot read (another origin without CORS) are
    // skipped rather than poisoning the canvas; a WebGL background paints
    // as black, which is the page's own ground colour.
    allowTaint: false,
    imageTimeout: 3000,
    ignoreElements: shouldMaskElement,
  });
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The capture produced no image.'))),
      'image/jpeg',
      quality
    );
  });
}
