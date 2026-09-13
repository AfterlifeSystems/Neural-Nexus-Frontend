// src/services/learnedFacts.js
//
// Facts the avatar stored during a turn. The live `fact_learned` frame and
// the reply's `response_metadata.learned_facts` are the same shape; this
// module is the one place that reads them onto a message.

const LEARNED_FACT_KINDS = new Set(['identity', 'preference', 'memory']);
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
 * @returns {{fact: string, kind: string, source: string}|null}
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
  return { fact, kind, source };
}

/**
 * @param {unknown} list
 * @returns {Array<{fact: string, kind: string, source: string}>}
 */
export function normalizeLearnedFacts(list) {
  if (!Array.isArray(list)) return [];
  const collected = [];
  const seen = new Set();
  for (const raw of list) {
    const entry = normalizeLearnedFact(raw);
    if (!entry) continue;
    const key = entry.fact.toLowerCase();
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
 * @returns {Array<{fact: string, kind: string, source: string}>}
 */
export function mergeLearnedFacts(current, incoming) {
  return normalizeLearnedFacts([...(Array.isArray(current) ? current : []), incoming]);
}

/**
 * Facts this reply stored. Live turns keep them on `learnedFacts`; a reloaded
 * transcript keeps them under `response_metadata.learned_facts`.
 *
 * @param {Object|null|undefined} message
 * @returns {Array<{fact: string, kind: string, source: string}>}
 */
export function learnedFactsOf(message) {
  if (!message) return [];
  if (Array.isArray(message.learnedFacts) && message.learnedFacts.length > 0) {
    return normalizeLearnedFacts(message.learnedFacts);
  }
  return normalizeLearnedFacts(message.response_metadata?.learned_facts);
}
