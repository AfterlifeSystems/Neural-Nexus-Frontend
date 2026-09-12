/**
 * The standard set of conversation starters, one per avatar.
 *
 * The messaging service writes three opening chips onto the avatar record
 * (`conversation_starters`, in the metadata for the owner and lifted to the
 * top level on public listings) — once when the avatar is created, again
 * when deep research finishes, and on the owner's request. Every browser
 * reads the same three chips from that record and keeps them in
 * `localStorage`, so a new conversation never pays a hidden avatar turn to
 * produce a list that already exists.
 *
 * Kept free of `import.meta.env` so the Node test runner can load it; the
 * network calls live in `avatarService.jsx` and `MediaContext.jsx`.
 */

import { conversationSuggestionsLookGeneric } from './conversationSuggestions.js';

export const STANDARD_STARTERS_STORAGE_KEY =
  'neuralNexus.standardConversationStarters.v1';
const STANDARD_STARTERS_STORAGE_MAX_ENTRIES = 60;
const STARTER_MAX_CHARACTERS = 160;
const STARTER_COUNT = 3;

const standardStartersByAssistant = new Map();
const standardStarterListeners = new Set();

function storage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function readStored() {
  const store = storage();
  if (!store) return {};
  try {
    const parsed = JSON.parse(store.getItem(STANDARD_STARTERS_STORAGE_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function writeStored(assistantId, record) {
  const store = storage();
  if (!store) return;
  try {
    const stored = readStored();
    delete stored[assistantId];
    const entries = Object.entries(stored).slice(
      -(STANDARD_STARTERS_STORAGE_MAX_ENTRIES - 1)
    );
    if (record) entries.push([assistantId, record]);
    store.setItem(
      STANDARD_STARTERS_STORAGE_KEY,
      JSON.stringify(Object.fromEntries(entries))
    );
  } catch {
    // Storage full or blocked; the in-memory map still serves this session.
  }
}

function notify(assistantId) {
  standardStarterListeners.forEach((listener) => {
    try {
      listener(assistantId);
    } catch {
      // One listener must not stop the others.
    }
  });
}

/**
 * The avatar id the record is keyed by.
 *
 * @param {Object|null|undefined} avatar
 * @returns {string}
 */
export function standardStartersAssistantIdOf(avatar) {
  return String(
    avatar?.assistant_id ?? avatar?.avatar_id ?? avatar?.metadata?.assistant_id ?? ''
  ).trim();
}

/**
 * Clean a stored or fetched record into `{ starters, generatedAt, source }`
 * or `null` when the record holds nothing usable.
 *
 * @param {*} candidate The raw `conversation_starters` value.
 * @returns {{starters: string[], generatedAt: string, source: string}|null}
 */
export function normalizeStandardStartersRecord(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return null;
  }
  const rawStarters = Array.isArray(candidate.starters) ? candidate.starters : [];
  const seen = new Set();
  const starters = [];
  for (const entry of rawStarters) {
    if (typeof entry !== 'string') continue;
    const text = entry.trim();
    if (!text || text.length > STARTER_MAX_CHARACTERS) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    starters.push(text);
    if (starters.length === STARTER_COUNT) break;
  }
  if (starters.length < 2 || conversationSuggestionsLookGeneric(starters)) {
    return null;
  }
  return {
    starters,
    generatedAt: String(candidate.generated_at ?? candidate.generatedAt ?? ''),
    source: String(candidate.source ?? ''),
  };
}

/**
 * The standard set carried on an avatar record, or `null`.
 *
 * Owners receive the record in the metadata; public listings lift the record
 * to the top level and drop the metadata.
 *
 * @param {Object|null|undefined} avatar
 * @returns {{starters: string[], generatedAt: string, source: string}|null}
 */
export function standardConversationStartersOf(avatar) {
  if (!avatar) return null;
  return (
    normalizeStandardStartersRecord(avatar.conversation_starters) ??
    normalizeStandardStartersRecord(avatar.metadata?.conversation_starters) ??
    null
  );
}

/**
 * The set this browser already holds for an avatar, or `null`.
 *
 * @param {string} assistantId
 * @returns {{starters: string[], generatedAt: string, source: string}|null}
 */
export function cachedStandardConversationStarters(assistantId) {
  const id = String(assistantId ?? '').trim();
  if (!id) return null;
  let record = standardStartersByAssistant.get(id) ?? null;
  if (!record) {
    record = normalizeStandardStartersRecord(readStored()[id]);
    if (record) standardStartersByAssistant.set(id, record);
  }
  return record;
}

/**
 * Whether `candidate` is a newer set than `current`.
 *
 * A record with no stamp never replaces a stamped one; two unstamped records
 * are the same set.
 */
function isNewerRecord(candidate, current) {
  if (!current) return true;
  if (!candidate) return false;
  if (!candidate.generatedAt) return false;
  if (!current.generatedAt) return true;
  return candidate.generatedAt > current.generatedAt;
}

/**
 * Keep a set for an avatar, in memory and in `localStorage`, and tell
 * listeners. A set older than the one held is ignored.
 *
 * @param {string} assistantId
 * @param {*} rawRecord The `conversation_starters` value from the record or the API.
 * @returns {{starters: string[], generatedAt: string, source: string}|null} What is held now.
 */
export function rememberStandardConversationStarters(assistantId, rawRecord) {
  const id = String(assistantId ?? '').trim();
  const record = normalizeStandardStartersRecord(rawRecord);
  if (!id || !record) return cachedStandardConversationStarters(id);
  const current = cachedStandardConversationStarters(id);
  if (current && !isNewerRecord(record, current)) return current;
  standardStartersByAssistant.set(id, record);
  writeStored(id, record);
  notify(id);
  return record;
}

/**
 * Drop the held set for an avatar (the avatar was deleted, or the set is
 * being regenerated and a stale list must not be served meanwhile).
 *
 * @param {string} assistantId
 */
export function forgetStandardConversationStarters(assistantId) {
  const id = String(assistantId ?? '').trim();
  if (!id) return;
  standardStartersByAssistant.delete(id);
  writeStored(id, null);
  notify(id);
}

/**
 * The three chips to paint for an empty conversation with this avatar.
 *
 * Prefers the record carried on the avatar (and remembers it when newer
 * than what the browser holds); otherwise what the browser holds from an
 * earlier visit. `null` when neither exists — the caller then asks the
 * messaging service once, or paints the local identity-leaned pool.
 *
 * @param {Object|null|undefined} avatar
 * @returns {string[]|null}
 */
export function resolveStandardConversationStarters(avatar) {
  const id = standardStartersAssistantIdOf(avatar);
  if (!id) return null;
  const onRecord = standardConversationStartersOf(avatar);
  if (onRecord) {
    return rememberStandardConversationStarters(id, {
      starters: onRecord.starters,
      generated_at: onRecord.generatedAt,
      source: onRecord.source,
    }).starters;
  }
  return cachedStandardConversationStarters(id)?.starters ?? null;
}

/**
 * Be told when an avatar's standard set changes (research finished, the
 * owner regenerated). The listener receives the assistant id.
 *
 * @param {(assistantId: string) => void} listener
 * @returns {() => void} Unsubscribe.
 */
export function subscribeStandardConversationStarters(listener) {
  standardStarterListeners.add(listener);
  return () => {
    standardStarterListeners.delete(listener);
  };
}

/** Test helper: drop the in-memory map, the stored sets, and the listeners. */
export function resetStandardConversationStartersForTests() {
  standardStartersByAssistant.clear();
  standardStarterListeners.clear();
  try {
    storage()?.removeItem(STANDARD_STARTERS_STORAGE_KEY);
  } catch {
    // No storage in this environment.
  }
}
