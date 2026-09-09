// src/services/usageAnalyticsApi.js
//
// The calls to the API's /usage_analytics/* routes. Kept apart from
// usageAnalytics.js so the pure helpers there can be loaded by the Node test
// runner without Vite's import.meta.env.

import { requestJson } from './neuralNexusApiClient';

// ── API ───────────────────────────────────────────────────────────────────

/**
 * Whether this account has opted in, and whether the deployment records at all.
 *
 * @returns {Promise<{enabled: boolean, feature_enabled: boolean, source: string|null}>}
 */
export const getUsageAnalyticsConsent = async () =>
  requestJson('/usage_analytics/consent');

/**
 * Opt the account in or out.
 *
 * @param {boolean} enabled
 * @param {string} source Where the choice was made: `avatar_settings` or
 *   `account_settings`.
 */
export const setUsageAnalyticsConsent = async (enabled, source) =>
  requestJson('/usage_analytics/consent', {
    method: 'POST',
    body: { enabled: Boolean(enabled), source },
  });

/**
 * Send one batch of events.
 *
 * @param {Object} batch `{session_id, assistant_id, thread_id, route, events}`.
 * @param {Object} [options]
 * @param {boolean} [options.keepalive] Let the request outlive the page (used
 *   when the tab is closing).
 */
export const sendUsageAnalyticsEvents = async (batch, { keepalive = false } = {}) =>
  requestJson('/usage_analytics/events', {
    method: 'POST',
    body: batch,
    keepalive,
  });

/**
 * Send one page capture with the recent actions the describer reads.
 *
 * @param {Blob} imageBlob The rendered page.
 * @param {Object} fields `{session_id, assistant_id, thread_id, route,
 *   trigger, recent_actions, occurred_at}`.
 */
export const sendUsageAnalyticsScreenshot = async (imageBlob, fields) => {
  const formData = new FormData();
  formData.append('file', imageBlob, 'capture.jpg');
  for (const [name, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null && value !== '') {
      formData.append(name, String(value));
    }
  }
  return requestJson('/usage_analytics/screenshots', {
    method: 'POST',
    formData,
  });
};

/**
 * Recent events and described captures of the signed-in account.
 *
 * @param {Object} [query] `{since, until, session_id, user_id, limit, offset}`.
 */
export const getUsageAnalyticsSummary = async (query = {}) =>
  requestJson('/usage_analytics/summary', { query });

/** Delete every stored event and capture of the account; consent stays as set. */
export const deleteUsageAnalyticsData = async () =>
  requestJson('/usage_analytics/data', { method: 'DELETE' });

