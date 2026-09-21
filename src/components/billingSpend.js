// src/components/billingSpend.js
//
// Pure helpers for the spend panel on the Billing page (SpendSummary.jsx):
// formatting money, naming each vendor report's state, and sizing the bars.

/** The windows the panel offers, in the order the buttons appear. */
export const SPEND_RANGE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'month', label: 'This month' },
];

/** The two scopes: every account, or the administrator's own account. */
export const SPEND_SCOPE_OPTIONS = [
  { value: 'platform', label: 'Whole platform' },
  { value: 'account', label: 'My account' },
];

/**
 * Format a dollar amount. Sub-cent amounts keep four decimals so a day of
 * cheap calls does not read as $0.00.
 *
 * @param {number|null|undefined} amountUsd
 * @returns {string}
 */
export const formatUsd = (amountUsd) => {
  if (
    amountUsd === null ||
    amountUsd === undefined ||
    Number.isNaN(amountUsd)
  ) {
    return '—';
  }
  const amount = Number(amountUsd);
  if (amount !== 0 && Math.abs(amount) < 0.01) {
    return `$${amount.toFixed(4)}`;
  }
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/**
 * Format a count with thousands separators.
 *
 * @param {number|null|undefined} count
 * @returns {string}
 */
export const formatCount = (count) =>
  Number(count || 0).toLocaleString('en-US');

/**
 * The share of the whole that one part is, as a width percentage for a bar.
 * A part that cost something never renders as an invisible zero-width bar.
 *
 * @param {number} partUsd
 * @param {number} wholeUsd
 * @returns {number} A percentage between 0 and 100.
 */
export const shareOfWholePercent = (partUsd, wholeUsd) => {
  if (!wholeUsd || wholeUsd <= 0 || !partUsd || partUsd <= 0) return 0;
  return Math.max(1, Math.min(100, (partUsd / wholeUsd) * 100));
};

/**
 * What a vendor report's status means, for the line under the vendor's name.
 *
 * @param {Object} vendorReport One entry of the response's `vendors` list.
 * @returns {string|null} A sentence for anything but a plain success.
 */
export const describeVendorStatus = (vendorReport) => {
  switch (vendorReport?.status) {
    case 'ok':
      return null;
    case 'needs_admin_key':
      return vendorReport.detail || 'The vendor needs an administrator key.';
    case 'not_configured':
      return vendorReport.detail || 'No key is configured for this vendor.';
    case 'unreachable':
      return 'The vendor could not be reached.';
    default:
      return vendorReport?.detail || 'The vendor answered with an error.';
  }
};

/**
 * The browser's own IANA time zone, so "today" is the reader's calendar day.
 *
 * @returns {string|undefined}
 */
export const browserTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
};
