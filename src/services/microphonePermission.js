// Browser microphone permission.
//
// A refusal is not a toast: the person already answered the browser prompt, or
// the site is blocked in settings. The microphone stays off until they allow
// it there. Dismissing the prompt (`AbortError`) is the same choice. Other
// capture failures (no device, an insecure origin) are still something to say.

/**
 * Whether a capture failure means the microphone is blocked or was refused.
 *
 * @param {Error|null|undefined} error
 * @returns {boolean}
 */
export function isMicrophoneAccessRefused(error) {
  const name = error?.name;
  return name === 'NotAllowedError' || name === 'AbortError';
}

/**
 * Watch the microphone permission.
 *
 * Calls `onChange` with `'granted' | 'denied' | 'prompt'` when it changes, and
 * once with the current state if this browser can report it. Returns an
 * unsubscribe function.
 *
 * Firefox and some WebKit builds throw on `permissions.query({ name:
 * 'microphone' })`; those browsers simply never notify, and unmute has to
 * ask `getUserMedia` again.
 *
 * @param {(state: PermissionState) => void} onChange
 * @param {PermissionStatus|Promise<PermissionStatus>} [queryResult] Injected
 *   in tests. Defaults to `navigator.permissions.query({ name: 'microphone' })`.
 * @returns {() => void} Unsubscribe.
 */
export function watchMicrophonePermission(onChange, queryResult) {
  if (typeof onChange !== 'function') return () => {};

  let cancelled = false;
  let status = null;

  const handleChange = () => {
    if (!cancelled && status?.state) onChange(status.state);
  };

  const start = (result) => {
    if (cancelled || !result) return;
    status = result;
    if (result.state) onChange(result.state);
    result.addEventListener?.('change', handleChange);
  };

  const query =
    queryResult ??
    (typeof navigator !== 'undefined' && navigator.permissions?.query
      ? navigator.permissions.query({ name: 'microphone' })
      : null);

  if (!query) return () => {};

  if (typeof query.then === 'function') {
    Promise.resolve(query)
      .then(start)
      .catch(() => {
        // This browser cannot report microphone permission.
      });
  } else {
    start(query);
  }

  return () => {
    cancelled = true;
    status?.removeEventListener?.('change', handleChange);
  };
}

/**
 * Whether a browser microphone prompt covers the page until answered.
 *
 * On a phone or tablet the prompt is a sheet or modal over the page: nothing
 * behind the prompt can be pressed, including "Switch to messages". Asking
 * for the microphone the moment the voice stage opens therefore traps a
 * person who only wanted to type. A desktop prompt hangs off the address bar
 * and leaves the page usable.
 *
 * @param {(query: string) => {matches: boolean}} [matchMedia]
 * @returns {boolean}
 */
export function microphonePromptCoversPage(
  matchMedia = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia.bind(window)
    : null
) {
  if (typeof matchMedia !== 'function') return false;
  try {
    return Boolean(matchMedia('(pointer: coarse)')?.matches);
  } catch {
    return false;
  }
}

/** Attribute on controls whose press must not ask for the microphone. */
export const MICROPHONE_TAP_EXEMPT_ATTRIBUTE = 'data-microphone-tap-exempt';

/**
 * Whether a press on `target` may ask for the microphone.
 *
 * Leaving voice mode, the workspace tabs, and the text box are ways of NOT
 * talking; a press there must never raise the microphone prompt.
 *
 * @param {Element|null|undefined} target
 * @returns {boolean}
 */
export function pressMayAskForMicrophone(target) {
  if (!target || typeof target.closest !== 'function') return true;
  return !target.closest(`[${MICROPHONE_TAP_EXEMPT_ATTRIBUTE}]`);
}
