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

function isStreamLive(stream) {
  if (!stream) return false;
  return stream
    .getVideoTracks()
    .some((track) => track.readyState !== 'ended');
}

/**
 * One screen capture for the whole page, shared by every part that shows the
 * screen to an avatar.
 *
 * The sidebar share controls, the avatar's "Let it look" prompt, and the help
 * avatar overlay each hold the screen separately. Without a shared capture,
 * sharing the screen with one and then with another opens the browser's
 * picker a second time for a screen the person is already sharing. A holder
 * that acquires while a capture is live receives the live capture with no
 * picker; a holder that acquires while the picker is open joins the open
 * picker. The capture stops only when the last holder releases the capture,
 * or when the person presses the browser's own "Stop sharing".
 *
 * @param {() => Promise<MediaStream>} startRequest Opens the picker.
 * @returns {{
 *   acquire: (holder: unknown) => Promise<MediaStream>,
 *   release: (holder: unknown) => void,
 * }}
 */
export function createSharedScreenCapture(startRequest) {
  let liveStream = null;
  const holders = new Set();
  const openPickerOnce = createSingleFlightRequest(async () => {
    const stream = await startRequest();
    holders.clear();
    liveStream = stream;
    stream.getVideoTracks()[0]?.addEventListener('ended', () => {
      if (liveStream !== stream) return;
      liveStream = null;
      holders.clear();
    });
    return stream;
  });

  return {
    acquire(holder) {
      if (isStreamLive(liveStream)) {
        holders.add(holder);
        return Promise.resolve(liveStream);
      }
      return openPickerOnce().then((stream) => {
        holders.add(holder);
        return stream;
      });
    },
    release(holder) {
      holders.delete(holder);
      if (holders.size > 0 || !liveStream) return;
      liveStream.getTracks().forEach((track) => track.stop());
      liveStream = null;
    },
  };
}

export const sharedScreenCapture = createSharedScreenCapture(requestDisplayMedia);
