// src/services/phoneCallListen.js
//
// The active SIP call the personal-avatar chat may listen in on.
// Written from the SSE loop (MediaContext) so the listen bar, mounted in
// ChatArea, can join the LiveKit room without reading conversation state.

const listeners = new Set();
let activePhoneCall = null;

/**
 * Record the latest phone_call frame from the chat stream.
 *
 * @param {Object|null} frame
 * @returns {void}
 */
export function setActivePhoneCall(frame) {
  activePhoneCall = frame ? { ...frame } : null;
  listeners.forEach((listener) => listener(activePhoneCall));
}

/**
 * Subscribe to phone_call frames. Returns an unsubscribe function.
 *
 * @param {(frame: Object|null) => void} listener
 * @returns {() => void}
 */
export function subscribeActivePhoneCall(listener) {
  listeners.add(listener);
  listener(activePhoneCall);
  return () => listeners.delete(listener);
}

/**
 * @returns {Object|null}
 */
export function readActivePhoneCall() {
  return activePhoneCall;
}
