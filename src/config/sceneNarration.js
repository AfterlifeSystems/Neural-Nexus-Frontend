// src/config/sceneNarration.js
//
// Scene narration: the accessibility mode in which the phone's rear camera is
// pointed at the world and whatever it sees is described to the person aloud,
// continuously, for as long as the mode is on. Built for a person who cannot
// see the scene — worn or held, the phone becomes a pair of eyes that talk.
//
// The switch belongs to the PERSON, not to any avatar, and is stored per
// browser like the other voice-mode preferences. Any avatar the person talks
// to may flip it by being asked (the API's `set_scene_narration` tool sends a
// `scene_narration` stream frame, which lands here), the help avatar included;
// account settings flip it by hand. Whichever avatar is
// on screen when the mode is on is the one that does the describing.
//
// Nothing about the camera is decided here. `MediaShareContext` reads this
// switch and opens the rear camera, paces the captures, and speaks the
// descriptions; this module only remembers the choice and tells listeners.

import {
  DEFAULT_SCENE_NARRATION_INTERVAL_SECONDS,
  snapNarrationSeconds,
} from './sceneNarrationInterval.js';

const STORAGE_KEY = 'scene_narration';
const listeners = new Set();

/** What every turn reports to the API while this browser can narrate. */
export const SCENE_NARRATION_ON = 'on';
export const SCENE_NARRATION_OFF = 'off';

/**
 * @param {unknown} [storage]
 * @returns {Storage|null}
 */
function storageOf(storage) {
  if (storage === undefined) return globalThis.localStorage ?? null;
  return storage ?? null;
}

/**
 * Whether scene narration is switched on in this browser.
 *
 * Off until the person (or an avatar they asked) turns it on: a camera that
 * opens and a voice that starts describing must never be a default.
 *
 * @param {Storage|null|undefined} [storage]
 * @returns {boolean}
 */
export function readSceneNarration(storage) {
  return Boolean(readSceneNarrationRecord(storage).enabled);
}

/**
 * The whole stored record: whether the mode is on, and how often it reads.
 *
 * @param {Storage|null|undefined} [storage]
 * @returns {{enabled: boolean, intervalSeconds: number}}
 */
export function readSceneNarrationRecord(storage) {
  try {
    const raw = storageOf(storage)?.getItem(STORAGE_KEY);
    if (!raw) return { enabled: false, intervalSeconds: DEFAULT_SCENE_NARRATION_INTERVAL_SECONDS };
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return {
        enabled: Boolean(parsed.enabled),
        intervalSeconds: clampNarrationSeconds(parsed.intervalSeconds),
      };
    }
    return {
      enabled: Boolean(parsed),
      intervalSeconds: DEFAULT_SCENE_NARRATION_INTERVAL_SECONDS,
    };
  } catch {
    return {
      enabled: false,
      intervalSeconds: DEFAULT_SCENE_NARRATION_INTERVAL_SECONDS,
    };
  }
}

/**
 * How many seconds the person wants between readings.
 *
 * @param {Storage|null|undefined} [storage]
 * @returns {number}
 */
export function readSceneNarrationSeconds(storage) {
  return readSceneNarrationRecord(storage).intervalSeconds;
}

/**
 * The offered pace nearest to whatever was asked for.
 *
 * Snapped rather than rejected, wherever a pace comes from — the slider, an
 * avatar asked for "much more often", a value stored by an older build.
 * Nothing about being asked for an odd pace should end in the person hearing
 * nothing, or in a pace nobody can name back to them.
 *
 * @param {unknown} seconds
 * @returns {number}
 */
export function clampNarrationSeconds(seconds) {
  return snapNarrationSeconds(seconds);
}

/**
 * Switch scene narration on or off, and tell every listener.
 *
 * @param {boolean} enabled
 * @param {Storage|null|undefined} [storage]
 * @returns {boolean} The state now in force.
 */
export function writeSceneNarration(enabled, storage) {
  const next = Boolean(enabled);
  const store = storageOf(storage);
  const intervalSeconds = readSceneNarrationRecord(storage).intervalSeconds;
  try {
    store?.setItem(
      STORAGE_KEY,
      JSON.stringify({ enabled: next, intervalSeconds })
    );
  } catch {
    // Private mode / quota: the choice then lasts only for this page.
  }
  for (const listener of listeners) listener(next, intervalSeconds);
  return next;
}

/**
 * Change how often the scene is read out, leaving the switch alone.
 *
 * Set by the slider in account settings and by any avatar asked to
 * describe things more or less often. Both land here, so the two can never
 * disagree about the pace.
 *
 * @param {number} seconds
 * @param {Storage|null|undefined} [storage]
 * @returns {number} The pace now in force, after clamping.
 */
export function writeSceneNarrationSeconds(seconds, storage) {
  const intervalSeconds = clampNarrationSeconds(seconds);
  const store = storageOf(storage);
  const enabled = readSceneNarrationRecord(storage).enabled;
  try {
    store?.setItem(STORAGE_KEY, JSON.stringify({ enabled, intervalSeconds }));
  } catch {
    // Private mode / quota: the pace then lasts only for this page.
  }
  for (const listener of listeners) listener(enabled, intervalSeconds);
  return intervalSeconds;
}

/**
 * @param {(enabled: boolean, intervalSeconds: number) => void} listener Called
 *   after every write, of the switch or of the pace.
 * @returns {Function} Unsubscribe.
 */
export function subscribeSceneNarration(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * The `scene_narration` form value a turn reports to the API.
 *
 * Sent on every turn from a browser that can narrate — `on` or `off` — so the
 * avatar is offered the switch and told which way it is set. A client that
 * cannot narrate sends nothing, and the API then offers no switch at all.
 *
 * @param {boolean} enabled
 * @returns {'on'|'off'}
 */
export function sceneNarrationFormValue(enabled) {
  return enabled ? SCENE_NARRATION_ON : SCENE_NARRATION_OFF;
}

/**
 * Read a `scene_narration` stream frame from the avatar.
 *
 * @param {Object} frame
 * @returns {{enabled: boolean, reason: string}|null} Null for a frame that is
 *   not a narration switch.
 */
export function sceneNarrationFromFrame(frame) {
  if (!frame || frame.type !== 'scene_narration') return null;
  return {
    enabled: Boolean(frame.enabled),
    // Absent whenever the avatar was asked only to start or stop; present when
    // it was asked to describe things more or less often.
    intervalSeconds:
      frame.every_seconds == null
        ? null
        : clampNarrationSeconds(frame.every_seconds),
    reason: typeof frame.reason === 'string' ? frame.reason : '',
  };
}
