// src/services/learnedFacts.js
//
// Facts the avatar accounted for during a turn. The live `fact_learned` frame
// and the reply's `response_metadata.learned_facts` are the same shape; this
// module is the one place that reads them onto a message.
//
// Every entry carries a `status`, so every fact the person shared is shown,
// not only the new ones:
//   learned — a new fact was stored
//   known   — the fact was already stored
//   updated — an approved correction rewrote a stored fact (`previousFact`
//             holds the text the correction replaced)
//   removed — an approved correction deleted a stored fact
// An entry from an older server carries no status and reads as `learned`.

const LEARNED_FACT_KINDS = new Set(['identity', 'preference', 'memory', 'user']);
export const LEARNED_FACT_STATUSES = new Set([
  'learned',
  'known',
  'updated',
  'removed',
]);
const MAXIMUM_FACT_CHARACTERS = 280;

/**
 * @param {unknown} value
 * @returns {string}
 */
function trimmedFact(value) {
  const text = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= MAXIMUM_FACT_CHARACTERS) return text;
  return `${text.slice(0, MAXIMUM_FACT_CHARACTERS - 1).trimEnd()}…`;
}

/**
 * One learned-fact entry, or null when the payload is empty.
 *
 * @param {Object|null|undefined} raw
 * @returns {{fact: string, kind: string, source: string, status: string, previousFact?: string}|null}
 */
export function normalizeLearnedFact(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const fact = trimmedFact(raw.fact);
  if (!fact) return null;
  const kind = LEARNED_FACT_KINDS.has(raw.kind) ? raw.kind : 'identity';
  const source =
    typeof raw.source === 'string' && raw.source.trim()
      ? raw.source.trim()
      : 'conversation';
  const status = LEARNED_FACT_STATUSES.has(raw.status) ? raw.status : 'learned';
  // The server sends `previous_fact`; a live message already normalized once
  // carries `previousFact`.
  const previousFact = trimmedFact(raw.previousFact ?? raw.previous_fact);
  const entry = { fact, kind, source, status };
  if (previousFact) entry.previousFact = previousFact;
  return entry;
}

/**
 * @param {unknown} list
 * @returns {Array<{fact: string, kind: string, source: string, status: string, previousFact?: string}>}
 */
export function normalizeLearnedFacts(list) {
  if (!Array.isArray(list)) return [];
  const collected = [];
  const seen = new Set();
  for (const raw of list) {
    const entry = normalizeLearnedFact(raw);
    if (!entry) continue;
    // One entry per fact and status: a correction can remove a fact and learn
    // the same words again in one turn, and both belong on the badge.
    const key = `${entry.status}:${entry.fact.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    collected.push(entry);
  }
  return collected;
}

/**
 * Facts already on the live message, plus one just learned.
 *
 * @param {unknown} current
 * @param {Object|null|undefined} incoming
 * @returns {Array<{fact: string, kind: string, source: string, status: string, previousFact?: string}>}
 */
export function mergeLearnedFacts(current, incoming) {
  return normalizeLearnedFacts([...(Array.isArray(current) ? current : []), incoming]);
}

/**
 * Facts this reply accounted for. Live turns keep them on `learnedFacts`; a reloaded
 * transcript keeps them under `response_metadata.learned_facts`.
 *
 * @param {Object|null|undefined} message
 * @returns {Array<{fact: string, kind: string, source: string, status: string, previousFact?: string}>}
 */
export function learnedFactsOf(message) {
  if (!message) return [];
  if (Array.isArray(message.learnedFacts) && message.learnedFacts.length > 0) {
    return normalizeLearnedFacts(message.learnedFacts);
  }
  return normalizeLearnedFacts(message.response_metadata?.learned_facts);
}
