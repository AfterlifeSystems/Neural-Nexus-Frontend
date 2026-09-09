// src/services/avatarStorageAndAdapter.js
//
// INERT SALVAGE — nothing imports this module yet.
//
// Storage-allotment and adapter-training calls against the Neural Nexus API,
// salvaged on 2026-09-09 from two commits that were reachable from no branch
// at all: `c62c798` (storage usage and add-on packs) and `d8d2c93` (the
// adapter card). Upstream these functions lived inside `avatarService.jsx`;
// they are kept in their own module here so the salvage does not touch that
// file, which is edited constantly.
//
// The six endpoints below are NOT served by the API yet either. They are
// salvaged in the API repository under `src/api/salvage/`, on routers that
// `webapp.py` never registers. Read `src/api/salvage/README.md` there before
// wiring any of this up: activation is a checklist on both sides, not just an
// import.
//
// On activation, move these functions into `avatarService.jsx` beside the
// other avatar calls and delete this file.

import { requestJson, streamServerSentEvents } from './neuralNexusApiClient';

/**
 * The avatar's storage: bytes used, the tier allotment, and purchased packs.
 * GET /avatar/{assistant_id}/storage
 */
export const getAvatarStorage = async (assistantId) => {
  return requestJson(`/avatar/${encodeURIComponent(assistantId)}/storage`);
};

/**
 * Buy storage add-on packs for one avatar through Stripe Checkout.
 * POST /avatar/{assistant_id}/storage/purchase
 *
 * @param {string} assistantId
 * @param {number} [packs] How many packs to buy.
 * @returns {Promise<Object>} `{url}` — the Checkout page to open.
 */
export const purchaseAvatarStorage = async (assistantId, packs = 1) => {
  return requestJson(`/avatar/${encodeURIComponent(assistantId)}/storage/purchase`, {
    method: 'POST',
    body: { packs },
  });
};

/**
 * The avatar's adapter state (trained / training / error) and the live job.
 * GET /avatar/{assistant_id}/adapter
 */
export const getAvatarAdapter = async (assistantId) => {
  return requestJson(`/avatar/${encodeURIComponent(assistantId)}/adapter`);
};

/**
 * Train (or retrain) the avatar's adapter on the adapter service. Premium only.
 * POST /avatar/{assistant_id}/train_adapter (responds 202 {job_id})
 */
export const trainAvatarAdapter = async (assistantId) => {
  return requestJson(`/avatar/${encodeURIComponent(assistantId)}/train_adapter`, {
    method: 'POST',
    body: {},
  });
};

/**
 * Follow the adapter training progress stream; the final frame has
 * `type: 'training_done'`.
 * GET /avatar/{assistant_id}/adapter/training_progress (server-sent events)
 */
export const streamAdapterTrainingProgress = async (assistantId, onEvent, signal) => {
  return streamServerSentEvents(
    `/avatar/${encodeURIComponent(assistantId)}/adapter/training_progress`,
    { method: 'GET', onEvent, signal }
  );
};

/**
 * Cancel the avatar's running adapter training.
 * POST /avatar/{assistant_id}/adapter/cancel
 */
export const cancelAvatarAdapterTraining = async (assistantId) => {
  return requestJson(`/avatar/${encodeURIComponent(assistantId)}/adapter/cancel`, {
    method: 'POST',
  });
};
