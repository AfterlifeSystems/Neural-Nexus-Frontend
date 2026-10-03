/**
 * Keeps the avatars hidden from the carousel on the account, not only in one browser.
 *
 * The API stores the account's hidden assistant ids (GET / PUT
 * /hidden_carousel_avatars), so signing in on another browser hides the same
 * avatars. This browser's localStorage list stays as a cache that paints the
 * carousel before the account answers.
 *
 * The first sign-in on a browser after the account list existed folds the
 * browser's own earlier hides into the account list once, so a hide made
 * before the account list existed is not lost. After that first sync the
 * account list is the truth: a stale browser list must not bring back an
 * avatar that was restored on another browser.
 */

import {
  readHiddenCarouselAvatarIds,
  writeHiddenCarouselAvatarIds,
} from './avatarCarouselMembership.js';

const SYNCED_ACCOUNTS_STORAGE_KEY = 'neural_nexus_hidden_carousel_synced_accounts';
const HIDDEN_CAROUSEL_AVATARS_PATH = '/hidden_carousel_avatars';

function readSyncedAccounts(storage) {
  try {
    const syncedAccounts = JSON.parse(
      storage?.getItem(SYNCED_ACCOUNTS_STORAGE_KEY) || '[]'
    );
    return Array.isArray(syncedAccounts) ? syncedAccounts : [];
  } catch {
    return [];
  }
}

function rememberSyncedAccount(userId, storage) {
  const syncedAccounts = readSyncedAccounts(storage);
  if (syncedAccounts.includes(userId)) return;
  try {
    storage?.setItem(
      SYNCED_ACCOUNTS_STORAGE_KEY,
      JSON.stringify([...syncedAccounts, userId])
    );
  } catch {
    // A refused write only means the next sign-in folds this browser's list
    // in again, which adds nothing the account does not already hold.
  }
}

/**
 * The account list followed by any browser-only hides, without duplicates.
 *
 * @param {string[]} accountHiddenIds
 * @param {string[]} browserHiddenIds
 * @returns {string[]}
 */
export function mergeHiddenCarouselIds(accountHiddenIds, browserHiddenIds) {
  return [...new Set([...(accountHiddenIds ?? []), ...(browserHiddenIds ?? [])])];
}

function sameIds(firstIds, secondIds) {
  return (
    firstIds.length === secondIds.length &&
    firstIds.every((assistantId, i) => assistantId === secondIds[i])
  );
}

/**
 * Read the account's hidden avatars and cache them in this browser.
 *
 * @param {string|null|undefined} userId
 * @param {Object} options
 * @param {(path: string, options?: Object) => Promise<*>} options.requestJson
 * @param {Storage|null|undefined} [options.storage]
 * @returns {Promise<string[]>} The hidden ids; the browser's cached list when
 *   the account cannot be read.
 */
export async function loadAccountHiddenCarouselAvatarIds(
  userId,
  { requestJson, storage = globalThis.localStorage }
) {
  const accountKey = String(userId ?? '').trim();
  const browserHiddenIds = readHiddenCarouselAvatarIds(accountKey, storage);
  if (!accountKey) return browserHiddenIds;
  try {
    const accountResponse = await requestJson(HIDDEN_CAROUSEL_AVATARS_PATH);
    const accountHiddenIds = Array.isArray(accountResponse?.assistant_ids)
      ? accountResponse.assistant_ids
      : [];
    let hiddenIds = accountHiddenIds;
    if (!readSyncedAccounts(storage).includes(accountKey)) {
      hiddenIds = mergeHiddenCarouselIds(accountHiddenIds, browserHiddenIds);
      if (!sameIds(hiddenIds, accountHiddenIds)) {
        const savedResponse = await requestJson(HIDDEN_CAROUSEL_AVATARS_PATH, {
          method: 'PUT',
          body: { assistant_ids: hiddenIds },
        });
        if (Array.isArray(savedResponse?.assistant_ids)) {
          hiddenIds = savedResponse.assistant_ids;
        }
      }
      rememberSyncedAccount(accountKey, storage);
    }
    writeHiddenCarouselAvatarIds(accountKey, hiddenIds, storage);
    return readHiddenCarouselAvatarIds(accountKey, storage);
  } catch (loadError) {
    console.error('Reading the hidden carousel avatars failed:', loadError);
    return browserHiddenIds;
  }
}

/**
 * Save the account's hidden avatars. The browser cache is written by the
 * caller first, so a failed save leaves this browser correct and the next
 * successful save brings the account up to date.
 *
 * @param {string|null|undefined} userId
 * @param {string[]} hiddenIds
 * @param {Object} options
 * @param {(path: string, options?: Object) => Promise<*>} options.requestJson
 * @returns {Promise<void>}
 */
export async function saveAccountHiddenCarouselAvatarIds(
  userId,
  hiddenIds,
  { requestJson }
) {
  if (!String(userId ?? '').trim()) return;
  try {
    await requestJson(HIDDEN_CAROUSEL_AVATARS_PATH, {
      method: 'PUT',
      body: { assistant_ids: hiddenIds },
    });
  } catch (saveError) {
    console.error('Saving the hidden carousel avatars failed:', saveError);
  }
}
