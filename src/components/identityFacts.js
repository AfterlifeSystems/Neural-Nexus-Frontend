// src/components/identityFacts.js
//
// The learnings list is one row per fact the avatar actually holds. The store
// can yield the same atomic fact twice — asearch returning the same item, or
// parallel "learn this" tool calls racing to write the same sentence under
// two UUIDs. Duplicate React keys then make the Context disclosure a no-op,
// and the filter chip (API counts) can disagree with how many cards render.
// Collapse onto the first row and recount so the list, the chip, and the
// clickable Context control describe the same set.

export const FACT_GROUP_ORDER = [
  'conversation',
  'media',
  'research',
  'analysis',
  'memory',
];

/**
 * @param {string|null|undefined} fact
 * @returns {string}
 */
export const normalizeFactText = (fact) => (fact ?? '').trim().toLowerCase();

/**
 * A stable identity for one store document: namespace and key together name
 * exactly one row. When the listing omitted a key, the group and the fact
 * text stand in so two empty-key copies of the same sentence still collide.
 *
 * @param {Object} fact A row from listAvatarIdentityFacts.
 * @returns {string}
 */
export const factRowKey = (fact) => {
  const namespace = (fact?.namespace ?? []).join('/');
  const storeId = fact?.key || fact?.factId || '';
  if (storeId) return `${namespace}::${storeId}`;
  return `${fact?.learnedFrom ?? 'conversation'}::${normalizeFactText(fact?.fact)}`;
};

/**
 * Identity for collapsing two rows that are the same learned sentence, even
 * when they were written under different store keys.
 *
 * @param {Object} fact
 * @returns {string}
 */
export const factTextIdentity = (fact) =>
  `${fact?.learnedFrom ?? 'conversation'}::${normalizeFactText(fact?.fact)}`;

/**
 * Filter the rows by group and by a text search over the fact and its context.
 *
 * @param {Array<Object>} facts
 * @param {string} groupFilter One of FACT_GROUP_ORDER, or 'all'.
 * @param {string} searchQuery
 * @returns {Array<Object>}
 */
export const filterFacts = (facts, groupFilter, searchQuery) => {
  const normalizedQuery = (searchQuery ?? '').trim().toLowerCase();
  return facts.filter((fact) => {
    if (groupFilter !== 'all' && fact.learnedFrom !== groupFilter) return false;
    if (!normalizedQuery) return true;
    return (
      (fact.fact ?? '').toLowerCase().includes(normalizedQuery) ||
      (fact.context ?? '').toLowerCase().includes(normalizedQuery) ||
      (fact.sourceLabel ?? '').toLowerCase().includes(normalizedQuery) ||
      (fact.feature ?? '').toLowerCase().includes(normalizedQuery)
    );
  });
};

/**
 * Count rows per `learnedFrom` group so a filter chip matches the list.
 *
 * @param {Array<Object>} facts
 * @returns {Object<string, number>}
 */
export const countsFromFacts = (facts) => {
  const counts = Object.fromEntries(FACT_GROUP_ORDER.map((group) => [group, 0]));
  for (const fact of facts ?? []) {
    const group = fact?.learnedFrom ?? 'conversation';
    counts[group] = (counts[group] ?? 0) + 1;
  }
  return counts;
};

const storeIdentity = (fact) =>
  `${(fact?.namespace ?? []).join('/')}::${fact?.key ?? fact?.factId ?? ''}`;

const collectDuplicate = (keeper, fact) => {
  const namespace = fact?.namespace;
  const key = fact?.key ?? fact?.factId;
  if (!key) return;
  if (storeIdentity(fact) === storeIdentity(keeper)) return;
  const already = (keeper.duplicateFacts ?? []).some(
    (entry) => storeIdentity(entry) === storeIdentity(fact)
  );
  if (already) return;
  if (!keeper.duplicateFacts) keeper.duplicateFacts = [];
  keeper.duplicateFacts.push({ namespace, key });
  for (const entry of fact.duplicateFacts ?? []) {
    collectDuplicate(keeper, entry);
  }
};

/**
 * One list row per store document, then one row per distinct sentence in a
 * group. The first row is kept; later copies contribute `duplicateFacts` so
 * Forget can remove every stored copy, not only the one that was showing.
 *
 * @param {Array<Object>} facts
 * @returns {Array<Object>}
 */
export const collapseDuplicateIdentityFacts = (facts) => {
  if (!Array.isArray(facts)) return [];

  const collapse = (rows, identityOf) => {
    const groups = [];
    const indexByIdentity = new Map();
    for (const fact of rows) {
      const identity = identityOf(fact);
      if (!identity) {
        groups.push(fact);
        continue;
      }
      if (indexByIdentity.has(identity)) {
        collectDuplicate(groups[indexByIdentity.get(identity)], fact);
        continue;
      }
      indexByIdentity.set(identity, groups.length);
      groups.push({ ...fact });
    }
    return groups;
  };

  const byStore = collapse(facts, (fact) => {
    const storeId = fact?.key || fact?.factId || '';
    if (!storeId && !(fact?.namespace ?? []).length) return factTextIdentity(fact);
    return factRowKey(fact);
  });
  return collapse(byStore, factTextIdentity);
};
