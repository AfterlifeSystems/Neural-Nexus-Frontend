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
