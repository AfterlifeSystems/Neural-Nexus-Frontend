// The calls to GET/POST /age_verification. Kept apart from the React
// screens so the Node test runner can load the helpers without Vite.

import { requestJson } from './neuralNexusApiClient';

/**
 * Whether this signed-in account has confirmed an age that unlocks
 * adult-only avatars in search.
 *
 * @returns {Promise<{verified: boolean, verified_at: string|null, minimum_years: number}>}
 */
export const getAgeVerification = async () => requestJson('/age_verification');

/**
 * Confirm this account's age with a date of birth.
 *
 * @param {string} dateOfBirth Calendar date as YYYY-MM-DD.
 * @param {string} [source] Where the confirmation was made.
 * @returns {Promise<{verified: boolean, verified_at: string|null, minimum_years: number}>}
 */
export const setAgeVerification = async (
  dateOfBirth,
  source = 'account_settings'
) =>
  requestJson('/age_verification', {
    method: 'POST',
    body: { date_of_birth: dateOfBirth, source },
  });
