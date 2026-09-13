// Query helpers for the personal-avatar inbox list and moderation decisions.

export const INBOX_SOURCE_FILTERS = [
  { id: 'all', sourceKind: '', label: 'All' },
  { id: 'moderation', sourceKind: 'moderation', label: 'Moderation' },
  { id: 'appeal', sourceKind: 'appeal', label: 'Appeals' },
  { id: 'report', sourceKind: 'report', label: 'Reports' },
  { id: 'mail', sourceKind: 'email', label: 'Mail' },
];

/**
 * Build the GET /inbox/items query the panel sends.
 *
 * @param {Object} options
 * @param {string} [options.state]
 * @param {string} [options.query]
 * @param {string} [options.sourceKind]
 * @param {number} [options.limit]
 * @returns {{state: string, limit: number, q?: string, source_kind?: string}}
 */
export function inboxListRequestOptions({
  state = 'open',
  query = '',
  sourceKind = '',
  limit = 100,
} = {}) {
  const options = { state, limit };
  const trimmedQuery = String(query || '').trim();
  if (trimmedQuery) {
    options.q = trimmedQuery;
  }
  const trimmedSource = String(sourceKind || '').trim();
  if (trimmedSource) {
    options.source_kind = trimmedSource;
  }
  return options;
}

/**
 * The HumanResponse the panel sends for a moderation revoke or accept.
 *
 * @param {'revoke_ban'|'accept_ban'} action
 * @returns {{type: 'accept', args: {action: string}}}
 */
export function moderationDecision(action) {
  return { type: 'accept', args: { action } };
}

/**
 * Whether this item is a ban verdict or an appeal of one.
 *
 * @param {Object} item
 * @returns {boolean}
 */
export function isBanDecisionItem(item) {
  return item?.source_kind === 'moderation' || item?.source_kind === 'appeal';
}

/**
 * Quoted lines the judge named, for a moderation inbox card.
 *
 * @param {Object} item
 * @returns {string[]}
 */
export function moderationEvidenceLines(item) {
  const detail = item?.confidence_detail || {};
  const fromDetail = detail.supporting_evidence;
  if (Array.isArray(fromDetail) && fromDetail.length) {
    return fromDetail.map((line) => String(line || '').trim()).filter(Boolean);
  }
  const blob = String(fromDetail || item?.snippet || '').trim();
  if (!blob) return [];
  return blob
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}
