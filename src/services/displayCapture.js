/**
 * Whether this browser can open a screen-share picker.
 *
 * `getDisplayMedia` is missing on many phone browsers (Chrome on iOS, older
 * Safari, in-app WebViews) and on insecure origins. The picker also needs
 * the `display-capture` permission when this page is inside an iframe.
 *
 * @returns {boolean}
 */
export function canCaptureDisplay() {
  if (typeof navigator === 'undefined') return false;
  return typeof getDisplayMediaRequest() === 'function';
}

/**
 * Open the browser's screen-share picker.
 *
 * @returns {Promise<MediaStream>}
 */
export function requestDisplayMedia() {
  const request = getDisplayMediaRequest();
  if (!request) {
    const error = new Error('This browser cannot share the screen.');
    error.name = 'NotSupportedError';
    throw error;
  }
  // Keep constraints loose. Tight ones (`displaySurface`, `preferCurrentTab`)
  // throw OverconstrainedError on phones that only offer the current tab.
  return request({
    video: true,
    audio: false,
  });
}

function getDisplayMediaRequest() {
  if (typeof navigator === 'undefined') return null;
  if (typeof navigator.mediaDevices?.getDisplayMedia === 'function') {
    return navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
  }
  if (typeof navigator.getDisplayMedia === 'function') {
    return navigator.getDisplayMedia.bind(navigator);
  }
  return null;
}
