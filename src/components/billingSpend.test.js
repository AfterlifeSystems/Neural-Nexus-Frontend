import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  describeVendorStatus,
  formatUsd,
  shareOfWholePercent,
} from './billingSpend.js';

test('sub-cent spend keeps four decimals instead of reading as zero', () => {
  assert.equal(formatUsd(0.0042), '$0.0042');
  assert.equal(formatUsd(0), '$0.00');
  assert.equal(formatUsd(1234.5), '$1,234.50');
  assert.equal(formatUsd(null), '—');
});

test('a category that cost something always gets a visible bar', () => {
  assert.equal(shareOfWholePercent(0.0001, 100), 1);
  assert.equal(shareOfWholePercent(50, 100), 50);
  assert.equal(shareOfWholePercent(0, 100), 0);
  assert.equal(shareOfWholePercent(5, 0), 0);
});

test('a vendor needing an administrator key says so rather than showing zero', () => {
  assert.equal(describeVendorStatus({ status: 'ok' }), null);
  assert.match(
    describeVendorStatus({
      status: 'needs_admin_key',
      detail: 'Set OPENAI_ADMIN_API_KEY.',
    }),
    /OPENAI_ADMIN_API_KEY/
  );
  assert.equal(
    describeVendorStatus({ status: 'unreachable' }),
    'The vendor could not be reached.'
  );
});
