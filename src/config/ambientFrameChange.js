// src/config/ambientFrameChange.js
//
// The pure half of the frame-change settings: how the environment's
// VITE_AMBIENT_FRAME_CHANGE_THRESHOLD and VITE_AMBIENT_QUIET_HEARTBEAT_SECONDS
// become numbers. Kept separate so the Node test runner can load this without
// Vite's import.meta.env.
//
// A webcam left on a still room produces the same picture every interval.
// Sending it costs a description call and a triage call and tells the avatar
// nothing it does not already know, so an unchanged frame is dropped before it
// leaves the browser.

/**
 * Mean brightness difference, from 0 to 1, that counts as the scene changing.
 *
 * Low enough that a person shifting in a chair registers, high enough that
 * sensor noise and a flickering light do not. Sensor noise on a still frame
 * measures well under 0.01; a person moving measures several times this.
 */
export const DEFAULT_AMBIENT_FRAME_CHANGE_THRESHOLD = 0.035;

/** How long an unchanging scene may go unsent before one frame is sent anyway. */
export const DEFAULT_AMBIENT_QUIET_HEARTBEAT_SECONDS = 600;

/**
 * Read the change threshold from the environment.
 *
 * A missing, non-numeric, or out-of-range value falls back to the default, so
 * a mistyped setting cannot turn the threshold into either a flood (0) or
 * permanent silence (above 1).
 *
 * @param {string|number|undefined|null} rawValue
 * @returns {number} A threshold between 0 and 1.
 */
export function ambientFrameChangeThreshold(rawValue) {
  const parsed = Number.parseFloat(String(rawValue ?? '').trim());
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1) {
    return DEFAULT_AMBIENT_FRAME_CHANGE_THRESHOLD;
  }
  return parsed;
}

/**
 * Read the quiet heartbeat from the environment, in milliseconds.
 *
 * A value of 0 turns the heartbeat off, so an unchanging scene is never sent.
 *
 * @param {string|number|undefined|null} rawValue
 * @returns {number} Milliseconds, or 0 when the heartbeat is off.
 */
export function ambientQuietHeartbeatMilliseconds(rawValue) {
  const raw = String(rawValue ?? '').trim();
  const parsed = Number.parseFloat(raw);
  if (raw !== '' && Number.isFinite(parsed) && parsed === 0) return 0;
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_AMBIENT_QUIET_HEARTBEAT_SECONDS * 1000;
  }
  return Math.round(parsed * 1000);
}
