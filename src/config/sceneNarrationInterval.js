// src/config/sceneNarrationInterval.js
//
// How often the camera is described while scene narration is on. Pure, so the
// Node test runner can load it without Vite's import.meta.env; the
// import.meta.env reads live in src/config/sceneNarrationCapture.js.
//
// Narration paces itself much faster than ordinary ambient vision, because the
// person is not sharing a room to be glanced at — they are walking through a
// place they cannot see and each description is the next thing they know. The
// floor is the API's own narration floor (SCENE_NARRATION_MIN_INTERVAL_SECONDS,
// not the ambient one): a browser faster than that has looks refused with 429.

/**
 * The paces offered, in seconds. Five named choices rather than a free slider.
 *
 * A continuous slider between three and a hundred and twenty seconds gave the
 * person a hundred and eighteen settings, almost all of them indistinguishable
 * from their neighbours, and no way to say which one they were on. These are
 * the five that mean something, and each one changes the LENGTH of a reading
 * as well as the gap between them — at five seconds a reading is a clause, at
 * a minute it is the fuller picture — so moving between them is audible rather
 * than theoretical.
 */
export const SCENE_NARRATION_PACE_OPTIONS = Object.freeze([5, 10, 15, 30, 60]);

export const DEFAULT_SCENE_NARRATION_INTERVAL_SECONDS = 5;

/**
 * The shortest narration interval the browser will use, whatever the setting.
 *
 * Its own floor, well under ordinary ambient vision's, and matching the API's
 * SCENE_NARRATION_MIN_INTERVAL_SECONDS. Sharing the ambient floor was wrong in
 * both directions: it paced narration for a person sitting at a desk, and
 * anything faster than the ambient floor was refused with 429.
 *
 * In practice the round trip — capture, describe, answer, speak — sets the real
 * pace, and the interval decides how soon the loop is allowed to ask again
 * once that round trip is done. The unchanged-frame filter means a scene that
 * has not moved still costs nothing at any interval.
 */
export const MINIMUM_SCENE_NARRATION_INTERVAL_SECONDS =
  SCENE_NARRATION_PACE_OPTIONS[0];

/**
 * The slowest pace the slider offers, matching the API's own ceiling.
 *
 * Past this the person is better served asking for a look when they want one
 * than leaving a mode running that speaks twice a minute.
 */
export const SLOWEST_SCENE_NARRATION_INTERVAL_SECONDS =
  SCENE_NARRATION_PACE_OPTIONS[SCENE_NARRATION_PACE_OPTIONS.length - 1];

/**
 * The offered pace nearest to whatever was asked for.
 *
 * Everything that sets a pace comes through here — the slider, an avatar asked
 * for "much more often", a value stored by an older build — so there is one
 * answer to "how often is it reading", and it is always one of the five the
 * person can be told the name of.
 *
 * @param {unknown} seconds
 * @returns {number} One of SCENE_NARRATION_PACE_OPTIONS.
 */
export function snapNarrationSeconds(seconds) {
  const parsed = Number.parseFloat(String(seconds ?? '').trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_SCENE_NARRATION_INTERVAL_SECONDS;
  }
  return SCENE_NARRATION_PACE_OPTIONS.reduce((nearest, option) =>
    Math.abs(option - parsed) < Math.abs(nearest - parsed) ? option : nearest
  );
}

/**
 * How long an unchanging scene may go undescribed before it is described
 * again anyway. Far shorter than ordinary ambient vision's heartbeat: a person
 * standing still, hearing nothing, cannot tell "nothing changed" from "it
 * stopped working" — and a repeated description a minute later tells them.
 */
export const DEFAULT_SCENE_NARRATION_HEARTBEAT_SECONDS = 45;

/**
 * Turn the environment's narration interval into milliseconds.
 *
 * A missing, empty, non-numeric, or too-small value falls back to the default
 * or the floor, so a mistyped setting slows narration rather than flooding.
 *
 * @param {string|number|undefined|null} rawValue What the environment holds.
 * @returns {number} Milliseconds between narrated captures.
 */
export function sceneNarrationIntervalMilliseconds(rawValue) {
  const parsed = Number.parseFloat(String(rawValue ?? '').trim());
  const seconds =
    Number.isFinite(parsed) && parsed > 0
      ? Math.max(parsed, MINIMUM_SCENE_NARRATION_INTERVAL_SECONDS)
      : DEFAULT_SCENE_NARRATION_INTERVAL_SECONDS;
  return Math.round(seconds * 1000);
}

/**
 * Turn the environment's narration heartbeat into milliseconds.
 *
 * Zero or a negative value switches the heartbeat off (only a changed scene is
 * described); anything unreadable falls back to the default.
 *
 * @param {string|number|undefined|null} rawValue What the environment holds.
 * @returns {number} Milliseconds, or 0 for no heartbeat.
 */
export function sceneNarrationHeartbeatMilliseconds(rawValue) {
  const text = String(rawValue ?? '').trim();
  if (!text) return DEFAULT_SCENE_NARRATION_HEARTBEAT_SECONDS * 1000;
  const parsed = Number.parseFloat(text);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_SCENE_NARRATION_HEARTBEAT_SECONDS * 1000;
  }
  return parsed <= 0 ? 0 : Math.round(parsed * 1000);
}
