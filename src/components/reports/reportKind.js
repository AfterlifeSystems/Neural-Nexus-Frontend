// src/components/reports/reportKind.js
//
// How a report's `kind` reads on a chip. Kept apart from the card so the
// card file exports only a component (fast refresh).

const KIND_LABELS = {
  analytics: 'Analytics',
  website_audit: 'Website audit',
  audit: 'Audit',
  finance: 'Finance',
  health: 'Health',
  fitness: 'Fitness',
  summary: 'Summary',
  scheduled: 'Scheduled',
};

/**
 * "Website audit" for `website_audit`; an unknown kind is shown as written
 * with underscores spaced out.
 *
 * @param {string} kind
 * @returns {string}
 */
export function reportKindLabel(kind) {
  if (!kind) return 'Report';
  return KIND_LABELS[kind] ?? String(kind).replace(/_/g, ' ');
}
