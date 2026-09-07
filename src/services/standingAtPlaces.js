// src/services/standingAtPlaces.js
//
// Which geo-located avatars the person is standing at right now.
//
// The position watch lives inside the router (so a shared link and a signed-in
// session can each open their own avatars), while the conversation store that
// builds every message request is mounted above the router. This module is the
// one line between them: the watch writes the set, and the message request
// reads it to set `at_place`.
//
// `at_place` changes only how the avatar greets its visitor. It is never a
// permission check — anyone may talk to a geo-located avatar from anywhere.

let assistantIdsStandingAt = new Set();

/**
 * Record which avatars' places the person is currently inside.
 *
 * @param {Iterable<string>} assistantIds
 * @returns {void}
 */
export function setStandingAtPlaces(assistantIds) {
  assistantIdsStandingAt = new Set(assistantIds ?? []);
}

/**
 * Whether the person is standing at this avatar's place.
 *
 * @param {string} assistantId
 * @returns {boolean}
 */
export function isStandingAtPlace(assistantId) {
  return Boolean(assistantId) && assistantIdsStandingAt.has(assistantId);
}
