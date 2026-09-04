// src/services/identityMediaJobs.js
//
// Follow identity-media uploads in the store that outlives Avatar Settings.
// Leaving the avatar no longer cancels or hides the checklist; opening
// Settings again also re-reads GET /media_jobs so a refresh, or a job started
// in another tab, comes back the same way.

import {
  applyMediaProgress,
  finalizePipelineSteps,
  mergeUploadItems,
  stepsForMediaKind,
} from './mediaProcessSteps.js';
import {
  cancelMediaJob,
  listMediaJobs,
  streamMediaJobProgress,
  uploadAvatarIdentityMedia,
} from './avatarService';
import { isBillingRefusal, showRequestFailureToast } from '../components/requestFailureToast';
import {
  addIdentityMediaJob,
  adoptListedMediaJobs,
  dropIdentityMediaJobCard,
  findIdentityMediaJob,
  mediaJobEntriesFromListResponse,
  newIdentityMediaLocalId,
  patchIdentityMediaJob,
  scheduleIdentityMediaJobDismiss,
  storeHasMediaJobId,
} from './identityMediaJobStore.js';

export {
  adoptListedMediaJobs,
  addIdentityMediaJob,
  dismissIdentityMediaJob,
  dropIdentityMediaJobCard,
  findIdentityMediaJob,
  kindFromMediaJobSnapshot,
  listStoredIdentityMediaJobs,
  mediaJobEntriesFromListResponse,
  panelJobFromMediaSnapshot,
  patchIdentityMediaJob,
  resetIdentityMediaJobsForTests,
  scheduleIdentityMediaJobDismiss,
  statusFromMediaJobSnapshot,
  subscribeIdentityMediaJobs,
} from './identityMediaJobStore.js';

const abortByLocalId = new Map();
const followingLocalIds = new Set();
const hydrateInFlight = new Map();

const describeRejected = (rejectedItems) =>
  Array.isArray(rejectedItems) && rejectedItems.length > 0
    ? `Not accepted: ${rejectedItems
        .map(
          (rejectedItem) =>
            `${rejectedItem.filename ?? rejectedItem.url ?? 'item'}${
              rejectedItem.reason ? ` (${rejectedItem.reason})` : ''
            }`
        )
        .join('; ')}`
    : null;

const finishOnStored = async (
  localId,
  kind,
  { confirmStored, onDocumentsChanged }
) => {
  if (onDocumentsChanged) {
    await onDocumentsChanged();
  }
  const confirmationFailure = confirmStored ? await confirmStored() : null;
  if (confirmationFailure) {
    patchIdentityMediaJob(localId, (job) => ({
      ...job,
      status: 'error',
      error: confirmationFailure,
    }));
    return false;
  }
  patchIdentityMediaJob(localId, (job) => {
    const steps = job.steps.map((step) => ({ ...step }));
    finalizePipelineSteps(steps, kind);
    return { ...job, steps, status: 'success', error: null };
  });
  scheduleIdentityMediaJobDismiss(localId);
  return true;
};

/**
 * Follow a job already in the store. Safe to call again: a second follow
 * for the same card is ignored. The progress stream replays buffered
 * events, so a card restored after leaving the avatar fills back in.
 *
 * @param {string} localId The card.
 * @param {Object} [options]
 * @param {Function} [options.confirmStored]
 * @param {Function} [options.onDocumentsChanged]
 * @returns {Promise<boolean>}
 */
export const followIdentityMediaJob = async (
  localId,
  { confirmStored, onDocumentsChanged } = {}
) => {
  if (followingLocalIds.has(localId)) return false;
  const job = findIdentityMediaJob(localId);
  if (!job?.jobId || job.status !== 'running') return false;
  followingLocalIds.add(localId);
  const abortController =
    abortByLocalId.get(localId) ?? new AbortController();
  abortByLocalId.set(localId, abortController);
  const kind = job.kind;

  let jobFailure = null;
  let wasCancelled = false;
  try {
    await streamMediaJobProgress(
      job.jobId,
      (progressEvent) => {
        if (progressEvent.type === 'media_progress') {
          patchIdentityMediaJob(localId, (current) => {
            const steps = current.steps.map((step) => ({ ...step }));
            applyMediaProgress(steps, progressEvent);
            return {
              ...current,
              steps,
              items: mergeUploadItems(current.items, progressEvent),
            };
          });
        } else if (progressEvent.type === 'done') {
          if (
            progressEvent.status === 'cancelled' ||
            progressEvent.error === 'cancelled'
          ) {
            wasCancelled = true;
          } else {
            jobFailure = progressEvent.error ?? null;
          }
        }
      },
      abortController.signal
    );

    if (wasCancelled || abortController.signal.aborted) {
      patchIdentityMediaJob(localId, (current) => ({
        ...current,
        status: 'cancelled',
        cancelling: false,
      }));
      scheduleIdentityMediaJobDismiss(localId);
      return false;
    }
    if (jobFailure) {
      patchIdentityMediaJob(localId, (current) => ({
        ...current,
        status: 'error',
        error: jobFailure,
        steps: current.steps.map((step) =>
          step.state === 'active' ? { ...step, state: 'error' } : step
        ),
      }));
      return false;
    }
    return finishOnStored(localId, kind, { confirmStored, onDocumentsChanged });
  } catch (streamError) {
    if (
      streamError?.name === 'AbortError' ||
      abortController.signal.aborted
    ) {
      patchIdentityMediaJob(localId, (current) => ({
        ...current,
        status: 'cancelled',
        cancelling: false,
      }));
      scheduleIdentityMediaJobDismiss(localId);
      return false;
    }
    const message =
      streamError?.message ?? 'The progress stream ended unexpectedly.';
    patchIdentityMediaJob(localId, (current) => ({
      ...current,
      status: 'error',
      error: message,
    }));
    return false;
  } finally {
    followingLocalIds.delete(localId);
    abortByLocalId.delete(localId);
  }
};

/**
 * Re-read the avatar's media jobs and put any missing ones back on the card
 * list. Failures are ignored: an older API without GET /media_jobs must not
 * blank Settings, and the in-memory store still covers leave-and-return.
 *
 * @param {string} assistantId The avatar.
 * @param {Object} [options]
 * @param {Function} [options.listJobs] Injected listing (tests).
 * @param {boolean} [options.resume]
 * @param {Function} [options.onDocumentsChanged]
 * @returns {Promise<number>}
 */
export const hydrateIdentityMediaJobs = async (
  assistantId,
  { listJobs = listMediaJobs, resume = true, onDocumentsChanged } = {}
) => {
  if (!assistantId) return 0;
  if (hydrateInFlight.has(assistantId)) {
    return hydrateInFlight.get(assistantId);
  }
  const request = (async () => {
    try {
      const response = await listJobs({
        assistantId,
        includeFinished: true,
      });
      const { added, runningLocalIds } = adoptListedMediaJobs(
        assistantId,
        mediaJobEntriesFromListResponse(response)
      );
      if (resume) {
        for (const localId of runningLocalIds) {
          followIdentityMediaJob(localId, { onDocumentsChanged });
        }
      }
      return added;
    } catch (listError) {
      console.debug('Listing media jobs failed:', listError);
      return 0;
    } finally {
      hydrateInFlight.delete(assistantId);
    }
  })();
  hydrateInFlight.set(assistantId, request);
  return request;
};

/**
 * Start an identity-media job and follow it in the store, not in the
 * Settings component. Leaving the avatar does not cancel or hide it.
 *
 * @param {Object} options
 * @param {string} options.assistantId
 * @param {File[]} [options.files]
 * @param {string[]} [options.urls]
 * @param {boolean} [options.isReferenceImage]
 * @param {boolean} [options.isReferenceAudio]
 * @param {Function} [options.confirmStored]
 * @param {Function} [options.onDocumentsChanged]
 * @returns {Promise<boolean>}
 */
export const startIdentityMediaUpload = async ({
  assistantId,
  files = [],
  urls = [],
  isReferenceImage = false,
  isReferenceAudio = false,
  confirmStored,
  onDocumentsChanged,
}) => {
  if (!assistantId) return false;
  if (files.length === 0 && urls.length === 0) return false;

  const localId = newIdentityMediaLocalId();
  const abortController = new AbortController();
  abortByLocalId.set(localId, abortController);
  const kind = isReferenceImage
    ? 'portrait'
    : isReferenceAudio
      ? 'voice'
      : 'document';
  const items = [
    ...urls.map((url) => ({
      id: url,
      label: url,
      itemJobId: null,
      state: 'running',
    })),
    ...files.map((file) => ({
      id: file.name,
      label: file.name,
      itemJobId: null,
      state: 'running',
    })),
  ];
  const title = items.length === 1 ? items[0].label : `${items.length} items`;

  addIdentityMediaJob({
    localId,
    assistantId,
    jobId: null,
    title,
    kind,
    items,
    steps: stepsForMediaKind(kind),
    status: 'running',
    error: null,
    cancelling: false,
  });

  try {
    const uploadResponse = await uploadAvatarIdentityMedia({
      assistantId,
      files,
      urls,
      isReferenceImage,
      isReferenceAudio,
      signal: abortController.signal,
    });
    const rejectedMessage = describeRejected(
      uploadResponse?.rejected ?? uploadResponse?.items_rejected ?? []
    );
    const jobId = uploadResponse?.job_id ?? null;

    if (storeHasMediaJobId(jobId, localId)) {
      // Settings remounted and restored this job while the POST was in flight.
      dropIdentityMediaJobCard(localId);
      abortByLocalId.delete(localId);
      return true;
    }

    patchIdentityMediaJob(localId, (job) => {
      const steps = job.steps.map((step) => ({ ...step }));
      applyMediaProgress(steps, {
        stage: 'upload',
        current: 1,
        total: 1,
      });
      return { ...job, jobId, steps, error: rejectedMessage };
    });

    if (!jobId) {
      if (rejectedMessage) {
        if (onDocumentsChanged) await onDocumentsChanged();
        patchIdentityMediaJob(localId, (job) => ({
          ...job,
          status: 'error',
          error: rejectedMessage,
        }));
        return false;
      }
      return finishOnStored(localId, kind, { confirmStored, onDocumentsChanged });
    }

    return followIdentityMediaJob(localId, {
      confirmStored,
      onDocumentsChanged,
    });
  } catch (uploadError) {
    if (
      uploadError?.name === 'AbortError' ||
      abortController.signal.aborted
    ) {
      patchIdentityMediaJob(localId, (job) => ({
        ...job,
        status: 'cancelled',
        cancelling: false,
      }));
      scheduleIdentityMediaJobDismiss(localId);
      return false;
    }
    console.error('Media upload failed:', uploadError);
    if (isBillingRefusal(uploadError)) {
      showRequestFailureToast(uploadError, {
        fallbackMessage: 'Upload failed.',
        position: 'top-right',
      });
    }
    patchIdentityMediaJob(localId, (job) => ({
      ...job,
      status: 'error',
      error: uploadError?.message || 'Upload failed.',
    }));
    return false;
  }
};

/**
 * Cancel the master job, or one child.
 *
 * @param {string} localId The card.
 * @param {string|null} [itemJobId] A child job, when cancelling one item.
 */
export const cancelIdentityMediaJob = async (localId, itemJobId = null) => {
  const job = findIdentityMediaJob(localId);
  if (!job || job.status !== 'running') return;
  patchIdentityMediaJob(localId, (current) => ({
    ...current,
    cancelling: true,
  }));
  const targetId = itemJobId || job.jobId;
  try {
    if (targetId) {
      await cancelMediaJob(targetId);
    }
  } catch (cancelError) {
    console.debug('Media job cancel failed:', cancelError);
  }
  if (itemJobId) {
    patchIdentityMediaJob(localId, (current) => ({
      ...current,
      cancelling: false,
      items: current.items.map((item) =>
        item.itemJobId === itemJobId ? { ...item, state: 'cancelled' } : item
      ),
    }));
    return;
  }
  abortByLocalId.get(localId)?.abort();
};
