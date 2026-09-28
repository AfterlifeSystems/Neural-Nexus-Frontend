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

/**
 * Wrap a request so that concurrent calls share one pending request.
 *
 * The screen-share picker must open exactly once per press. While a picker is
 * still open, the page has no capture yet, so a second press (a double click,
 * a press on the same control in the sidebar panel that just opened, or a
 * press on the avatar's "Let it look" prompt) would otherwise call
 * `getDisplayMedia` again and stack a second picker behind the first. Every
 * call made while a request is pending receives the pending request's promise
 * instead, and the next call after the request settles starts a new request.
 *
 * The request starts synchronously, inside the caller's press, so the browser
 * still sees the user gesture that `getDisplayMedia` requires.
 *
 * @template T
 * @param {() => Promise<T>} startRequest
 * @returns {() => Promise<T>}
 */
export function createSingleFlightRequest(startRequest) {
  let pendingRequest = null;
  return function runSingleFlightRequest() {
    if (pendingRequest) return pendingRequest;
    let startedRequest;
    try {
      startedRequest = Promise.resolve(startRequest());
    } catch (startError) {
      return Promise.reject(startError);
    }
    const clearPendingRequest = () => {
      if (pendingRequest === startedRequest) pendingRequest = null;
    };
    pendingRequest = startedRequest;
    startedRequest.then(clearPendingRequest, clearPendingRequest);
    return startedRequest;
  };
}
