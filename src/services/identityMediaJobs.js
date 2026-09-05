// src/services/identityMediaJobs.js
//
// Follow identity-media uploads in the store that outlives Avatar Settings.
// Leaving the avatar no longer cancels or hides the checklist; opening
// Settings again also re-reads GET /media_jobs so a refresh, or a job started
// in another tab, comes back the same way.

import {
  applyMediaProgress,
  finalizePipelineSteps,
  isGenericMediaLabel,
  stepsForMediaKind,
} from './mediaProcessSteps.js';
import {
  cancelMediaJob,
  getMediaJob,
  listMediaJobs,
  streamMediaJobProgress,
  uploadAvatarIdentityMedia,
} from './avatarService';
import { isBillingRefusal, showRequestFailureToast } from '../components/requestFailureToast';
import {
  addIdentityMediaJob,
  adoptListedMediaJobs,
  applyMediaSnapshotToPanelJob,
  dropIdentityMediaJobCard,
  findIdentityMediaJob,
  listStoredIdentityMediaJobs,
  markMissingRunningJobsLost,
  mediaJobEntriesFromListResponse,
  newIdentityMediaLocalId,
  patchIdentityMediaJob,
  scheduleIdentityMediaJobDismiss,
  storeHasMediaJobId,
  transferIdentityMediaJobLabels,
} from './identityMediaJobStore.js';
import {
  MEDIA_JOB_LOST_MESSAGE,
  MEDIA_JOB_RECONNECT_ATTEMPTS,
  MEDIA_JOB_RECONNECT_DELAY_MS,
  MEDIA_JOB_UNREACHABLE_MESSAGE,
  mergeMediaJobTiming,
  timingFromMediaJobFrame,
  timingFromMediaJobSnapshot,
} from './mediaJobTiming.js';
import { notifyAvatarPortraitChanged } from './avatarPortraitEvents.js';
import {
  cancelIdentityMediaJobCard,
  checkMediaJobOnServer,
  failIdentityMediaJob,
  streamMediaJobOnce,
  wait,
} from './mediaJobFollow.js';

export {
  adoptListedMediaJobs,
  addIdentityMediaJob,
  applyMediaSnapshotToPanelJob,
  dismissIdentityMediaJob,
  dropIdentityMediaJobCard,
  findIdentityMediaJob,
  kindFromMediaJobSnapshot,
  listStoredIdentityMediaJobs,
  markMissingRunningJobsLost,
  mediaJobEntriesFromListResponse,
  panelJobFromMediaSnapshot,
  patchIdentityMediaJob,
  resetIdentityMediaJobsForTests,
  scheduleIdentityMediaJobDismiss,
  statusFromMediaJobSnapshot,
  subscribeIdentityMediaJobs,
  transferIdentityMediaJobLabels,
} from './identityMediaJobStore.js';

const abortByLocalId = new Map();
const followingLocalIds = new Set();
const hydrateInFlight = new Map();

const previewUrlForFile = (file) => {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return null;
  }
  if (!file?.type?.startsWith('image/')) return null;
  try {
    return URL.createObjectURL(file);
  } catch {
    return null;
  }
};

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
  if (kind === 'portrait') {
    // The portrait is stored and its emotion stills and loops are generated
    // by the time the job reports done. Tell every screen holding the old
    // portrait (or the pre-upload empty manifest) to read the new one — this
    // is the only path a card restored after a page reload, or started from
    // the Upload section with the reference flag, ever takes.
    notifyAvatarPortraitChanged(findIdentityMediaJob(localId)?.assistantId);
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
 * A stream that ends without a `done` frame, or goes silent past the
 * keep-alive cadence, is not a finished job. The server is asked what
 * became of it: a 404 means the API process restarted and the job is gone
 * (the card fails with MEDIA_JOB_LOST_MESSAGE); a job still running is
 * re-followed; a job that finished meanwhile is closed out normally.
 *
 * @param {string} localId The card.
 * @param {Object} [options]
 * @param {Function} [options.confirmStored]
 * @param {Function} [options.onDocumentsChanged]
 * @param {Function} [options.streamJob] Injected stream (tests).
 * @param {Function} [options.getJob] Injected snapshot (tests).
 * @param {number} [options.reconnectDelayMs] Injected pause (tests).
 * @returns {Promise<boolean>}
 */
export const followIdentityMediaJob = async (
  localId,
  {
    confirmStored,
    onDocumentsChanged,
    streamJob = streamMediaJobProgress,
    getJob = getMediaJob,
    reconnectDelayMs = MEDIA_JOB_RECONNECT_DELAY_MS,
  } = {}
) => {
  if (followingLocalIds.has(localId)) return false;
  const job = findIdentityMediaJob(localId);
  if (!job?.jobId || job.status !== 'running') return false;
  followingLocalIds.add(localId);
  const abortController =
    abortByLocalId.get(localId) ?? new AbortController();
  abortByLocalId.set(localId, abortController);
  const kind = job.kind;
  const jobId = job.jobId;

  try {
    let unreachableAttempts = 0;
    for (;;) {
      const outcome = await streamMediaJobOnce({
        localId,
        jobId,
        streamJob,
        userSignal: abortController.signal,
      });
      if (abortController.signal.aborted) {
        cancelIdentityMediaJobCard(localId);
        return false;
      }

      if (outcome.ended === 'done') {
        const doneFrame = outcome.doneFrame;
        if (
          doneFrame.status === 'cancelled' ||
          doneFrame.error === 'cancelled'
        ) {
          cancelIdentityMediaJobCard(localId);
          return false;
        }
        if (doneFrame.error) {
          failIdentityMediaJob(localId, doneFrame.error);
          return false;
        }
        return finishOnStored(localId, kind, { confirmStored, onDocumentsChanged });
      }

      const serverState = await checkMediaJobOnServer({ localId, jobId, getJob });
      if (abortController.signal.aborted) {
        cancelIdentityMediaJobCard(localId);
        return false;
      }
      if (serverState === 'lost') {
        failIdentityMediaJob(localId, MEDIA_JOB_LOST_MESSAGE);
        return false;
      }
      if (serverState === 'completed') {
        return finishOnStored(localId, kind, { confirmStored, onDocumentsChanged });
      }
      if (serverState === 'error') {
        const current = findIdentityMediaJob(localId);
        failIdentityMediaJob(localId, current?.error || 'Processing failed.');
        return false;
      }
      if (serverState === 'cancelled') {
        cancelIdentityMediaJobCard(localId);
        return false;
      }
      if (serverState === 'unreachable') {
        unreachableAttempts += 1;
        if (unreachableAttempts >= MEDIA_JOB_RECONNECT_ATTEMPTS) {
          failIdentityMediaJob(
            localId,
            outcome.error?.message
              ? `${MEDIA_JOB_UNREACHABLE_MESSAGE} (${outcome.error.message})`
              : MEDIA_JOB_UNREACHABLE_MESSAGE
          );
          return false;
        }
      } else {
        unreachableAttempts = 0;
      }
      // Still running (or the server is coming back): re-open the stream,
      // which replays buffered frames from the start.
      await wait(reconnectDelayMs);
      if (abortController.signal.aborted) {
        cancelIdentityMediaJobCard(localId);
        return false;
      }
    }
  } catch (followError) {
    if (
      followError?.name === 'AbortError' ||
      abortController.signal.aborted
    ) {
      cancelIdentityMediaJobCard(localId);
      return false;
    }
    failIdentityMediaJob(
      localId,
      followError?.message ?? 'The progress stream ended unexpectedly.'
    );
    return false;
  } finally {
    followingLocalIds.delete(localId);
    abortByLocalId.delete(localId);
  }
};

const jobNeedsMediaLabel = (job) =>
  !job ||
  isGenericMediaLabel(job.title) ||
  !job.items?.some((item) => !isGenericMediaLabel(item.label));

const enrichIdentityMediaJobFromServer = async (localId, getJob) => {
  const job = findIdentityMediaJob(localId);
  if (!job?.jobId || !jobNeedsMediaLabel(job)) return;
  try {
    const snapshot = await getJob(job.jobId);
    patchIdentityMediaJob(localId, (current) =>
      applyMediaSnapshotToPanelJob(current, snapshot)
    );
  } catch (enrichError) {
    console.debug('Enriching media job failed:', enrichError);
  }
};

/**
 * Re-read the avatar's media jobs and put any missing ones back on the card
 * list. Failures are ignored: an older API without GET /media_jobs must not
 * blank Settings, and the in-memory store still covers leave-and-return.
 *
 * The list endpoint does not include filenames. Cards restored from it are
 * filled in from GET /media_job/{id} (and later from the progress stream).
 *
 * @param {string} assistantId The avatar.
 * @param {Object} [options]
 * @param {Function} [options.listJobs] Injected listing (tests).
 * @param {Function} [options.getJob] Injected snapshot (tests).
 * @param {boolean} [options.resume]
 * @param {Function} [options.onDocumentsChanged]
 * @returns {Promise<number>}
 */
export const hydrateIdentityMediaJobs = async (
  assistantId,
  {
    listJobs = listMediaJobs,
    getJob = getMediaJob,
    resume = true,
    onDocumentsChanged,
  } = {}
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
      const entries = mediaJobEntriesFromListResponse(response);
      const { added, addedLocalIds, runningLocalIds } = adoptListedMediaJobs(
        assistantId,
        entries
      );
      // The listing includes finished jobs, so a running card whose server
      // id is absent is following a job the API process no longer has (it
      // restarted). Say so rather than leaving the card spinning.
      markMissingRunningJobsLost(
        assistantId,
        entries.map((entry) => entry?.job_id ?? entry?.id).filter(Boolean)
      );
      for (const entry of entries) {
        const entryJobId = entry?.job_id ?? entry?.id;
        const timing = timingFromMediaJobSnapshot(entry);
        if (!entryJobId || !timing) continue;
        const known = listStoredIdentityMediaJobs(assistantId).find(
          (candidate) => candidate.jobId === entryJobId
        );
        if (known) {
          patchIdentityMediaJob(known.localId, (current) => ({
            ...current,
            timing: mergeMediaJobTiming(current.timing ?? null, timing),
          }));
        }
      }
      for (const localId of addedLocalIds ?? []) {
        await enrichIdentityMediaJobFromServer(localId, getJob);
      }
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
 * @param {boolean} [options.isReferenceAudio] Legacy flag: the server now
 *   decides the reference clip on its own, so callers pass `kind: 'voice'`
 *   for speech instead.
 * @param {'portrait'|'voice'|'document'} [options.kind] Which card and steps
 *   to show. Defaults from the reference flags, else 'document'.
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
  kind: explicitKind,
  confirmStored,
  onDocumentsChanged,
}) => {
  if (!assistantId) return false;
  if (files.length === 0 && urls.length === 0) return false;

  const localId = newIdentityMediaLocalId();
  const abortController = new AbortController();
  abortByLocalId.set(localId, abortController);
  const kind =
    explicitKind ??
    (isReferenceImage ? 'portrait' : isReferenceAudio ? 'voice' : 'document');
  const items = [
    ...urls.map((url) => ({
      id: url,
      label: url,
      itemJobId: null,
      state: 'running',
      previewUrl: null,
    })),
    ...files.map((file) => ({
      id: file.name,
      label: file.name,
      itemJobId: null,
      state: 'running',
      previewUrl: previewUrlForFile(file),
      contentType: file.type || null,
    })),
  ];
  const title = items.length === 1 ? items[0].label : `${items.length} items`;
  const previewUrl = items.find((item) => item.previewUrl)?.previewUrl ?? null;

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
    previewUrl,
    // The card knows when it was started even before the server answers, so
    // the panel can say how long the upload has been running for any kind
    // of media — documents and images get no estimate from the API, and the
    // server's own started_at only arrives with the first progress frame.
    timing: timingFromMediaJobFrame({ started_at: Date.now() / 1000 }),
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
      // The list snapshot has no filename; keep the name this tab already knows.
      transferIdentityMediaJobLabels(localId, jobId);
      dropIdentityMediaJobCard(localId);
      abortByLocalId.delete(localId);
      return true;
    }

    const acceptedTiming = timingFromMediaJobFrame({
      estimated_processing_seconds:
        uploadResponse?.estimated_processing_seconds_total ?? null,
      estimated_media_seconds: uploadResponse?.estimated_media_seconds_total ?? null,
    });
    patchIdentityMediaJob(localId, (job) => {
      const steps = job.steps.map((step) => ({ ...step }));
      applyMediaProgress(steps, {
        stage: 'upload',
        current: 1,
        total: 1,
      });
      return {
        ...job,
        jobId,
        steps,
        error: rejectedMessage,
        timing: mergeMediaJobTiming(job.timing ?? null, acceptedTiming),
      };
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
