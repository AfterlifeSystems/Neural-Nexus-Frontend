// src/services/billingSpendApi.js
//
// The call to the API's GET /billing/spend route: what Neural Nexus actually
// spent, and on what, read from the API's own cost ledger and from the vendors
// rather than from Stripe. Kept apart from billingSpend.js so the pure helpers
// there can be loaded by the Node test runner without Vite's import.meta.env.

import { requestJson } from './neuralNexusApiClient';

/**
 * The spend report for one window. Administrator only; any other account is
 * refused with 403.
 *
 * @param {Object} query
 * @param {'today'|'7d'|'30d'|'month'} query.range The window, counted from
 *   local midnight.
 * @param {'platform'|'account'} query.scope Every account, or the
 *   administrator's own account.
 * @param {string} [query.timezone] The IANA time zone the days are counted in.
 * @returns {Promise<Object>} `{range, scope, timezone, since, until, recorded, vendors}`.
 */
export const getBillingSpend = async ({ range, scope, timezone }) =>
  requestJson('/billing/spend', { query: { range, scope, timezone } });
