// src/services/identityMediaJobStore.js
//
// In-memory identity-media upload cards. Avatar Settings used to hold these
// in React state, so leaving the avatar unmounted the checklist. The store
// outlives that screen. Mapping from GET /media_jobs lives here so tests can
// cover restore without loading the API client.

import {
  MEDIA_JOB_LOST_MESSAGE,
  mergeMediaJobTiming,
  timingFromMediaJobSnapshot,
} from './mediaJobTiming.js';
import { isVoiceMediaFilename } from './voiceMedia.js';
import {
  applyMediaProgress,
  fallbackTitleForKind,
  finalizePipelineSteps,
  firstRealMediaLabel,
  isGenericMediaLabel,
  stepsForMediaKind,
  titleFromUploadItems,
} from './mediaProcessSteps.js';

let jobs = [];
const listeners = new Set();
const dismissTimerByLocalId = new Map();
const dismissedJobIds = new Set();

const emit = () => {
  for (const listener of listeners) listener();
};

export const newIdentityMediaLocalId = () =>
  `section-upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * @param {Function} onChange Called whenever the stored jobs change.
 * @returns {Function} Unsubscribe.
 */
export const subscribeIdentityMediaJobs = (onChange) => {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
};

/**
 * @param {string} assistantId The avatar.
 * @returns {Array<Object>} Jobs for that avatar, in store order.
 */
export const listStoredIdentityMediaJobs = (assistantId) => {
  if (!assistantId) return [];
  return jobs.filter((job) => job.assistantId === assistantId);
};

/**
 * @param {string} localId The card.
 * @returns {Object|undefined}
 */
export const findIdentityMediaJob = (localId) =>
  jobs.find((job) => job.localId === localId);

/**
 * Drop every stored job. Tests only.
 */
export const resetIdentityMediaJobsForTests = () => {
  jobs = [];
  for (const timer of dismissTimerByLocalId.values()) {
    clearTimeout(timer);
  }
  dismissTimerByLocalId.clear();
  dismissedJobIds.clear();
};

/**
 * Unwrap GET /media_jobs, which may be a bare array or a `{jobs}` / `{items}`
 * envelope depending on the API revision.
 *
 * @param {Object|Array|null} response The listing body.
 * @returns {Array<Object>}
 */
export const mediaJobEntriesFromListResponse = (response) => {
  if (Array.isArray(response)) return response;
  if (!response || typeof response !== 'object') return [];
  if (Array.isArray(response.jobs)) return response.jobs;
  if (Array.isArray(response.items)) return response.items;
  if (Array.isArray(response.media_jobs)) return response.media_jobs;
  return [];
};

/**
 * @param {Object} entry A list or snapshot row.
 * @returns {'portrait'|'voice'|'document'}
 */
export const kindFromMediaJobSnapshot = (entry) => {
  if (
    entry?.reference_image === true ||
    entry?.is_reference_image === true ||
    entry?.kind === 'portrait' ||
    entry?.job_kind === 'portrait'
  ) {
    return 'portrait';
  }
  if (
    entry?.reference_audio === true ||
    entry?.is_reference_audio === true ||
    entry?.kind === 'voice' ||
    entry?.job_kind === 'voice'
  ) {
    return 'voice';
  }
  // Speech uploads carry no reference flag any more (the server decides the
  // reference clip), so an audio or video filename is what marks the job.
  const filenames = [
    entry?.filename,
    ...(Array.isArray(entry?.children)
      ? entry.children.map((child) => child?.filename)
      : []),
  ].filter(Boolean);
  if (filenames.length > 0 && filenames.every(isVoiceMediaFilename)) {
    return 'voice';
  }
  const label = String(
    entry?.description ?? entry?.title ?? entry?.filename ?? ''
  ).toLowerCase();
  if (label.includes('portrait') || label.includes('reference image')) {
    return 'portrait';
  }
  if (label.includes('voice') || label.includes('reference audio')) {
    return 'voice';
  }
  return 'document';
};

/**
 * @param {Object} entry A list or snapshot row.
 * @returns {'running'|'success'|'error'|'cancelled'}
 */
export const statusFromMediaJobSnapshot = (entry) => {
  const raw = String(entry?.status ?? entry?.state ?? '').toLowerCase();
  if (raw === 'cancelled' || raw === 'canceled') return 'cancelled';
  if (raw === 'error' || raw === 'failed' || raw === 'failure') return 'error';
  if (
    entry?.error &&
    (raw === 'done' || raw === 'completed' || raw === 'success')
  ) {
    return 'error';
  }
  if (
    raw === 'done' ||
    raw === 'completed' ||
    raw === 'success' ||
    raw === 'finished'
  ) {
    return 'success';
  }
  return 'running';
};

const childItemsFromSnapshot = (entry) => {
  const children = Array.isArray(entry?.children)
    ? entry.children
    : Array.isArray(entry?.items)
      ? entry.items
      : Array.isArray(entry?.child_jobs)
        ? entry.child_jobs
        : [];
  return children
    .filter((child) => child && typeof child === 'object')
    .map((child, index) => ({
      id:
        child.job_id ||
        child.id ||
        child.filename ||
        child.url ||
        `item-${index}`,
      label:
        firstRealMediaLabel([
          child.filename,
          child.namespace_filename,
          child.url,
          child.label,
          child.description,
        ]) || 'Item',
      itemJobId: child.job_id || child.id || null,
      state:
        statusFromMediaJobSnapshot(child) === 'running'
          ? 'running'
          : statusFromMediaJobSnapshot(child),
    }));
};

const applySnapshotProgress = (steps, entry, kind) => {
  const progress =
    entry?.progress ||
    entry?.last_progress ||
    entry?.latest_progress ||
    null;
  if (progress && typeof progress === 'object') {
    applyMediaProgress(steps, progress);
  }
  if (entry?.stage) {
    applyMediaProgress(steps, {
      stage: entry.stage,
      current: entry.current ?? entry.documents_indexed,
      total: entry.total ?? entry.documents_total,
    });
  }
  const status = statusFromMediaJobSnapshot(entry);
  if (status === 'success' || status === 'cancelled') {
    finalizePipelineSteps(steps, kind);
  }
  if (status === 'error') {
    const active = steps.find((step) => step.state === 'active');
    if (active) active.state = 'error';
  }
};

/**
 * Build the UploadProcessPanel job the Settings screen already renders.
 *
 * @param {Object} entry A GET /media_jobs or GET /media_job/{id} row.
 * @param {string} assistantId The avatar this job belongs to.
 * @returns {Object}
 */
export const panelJobFromMediaSnapshot = (entry, assistantId) => {
  const kind = kindFromMediaJobSnapshot(entry);
  const steps = stepsForMediaKind(kind);
  applySnapshotProgress(steps, entry, kind);
  const items = childItemsFromSnapshot(entry);
  const title =
    firstRealMediaLabel([
      entry?.filename,
      entry?.namespace_filename,
      entry?.original_filename,
      items[0]?.label,
      entry?.description,
      entry?.title,
    ]) || fallbackTitleForKind(kind);
  if (items.length === 0) {
    const itemLabel = firstRealMediaLabel([
      entry?.filename,
      entry?.namespace_filename,
      title,
    ]);
    if (itemLabel) {
      items.push({
        id: entry?.job_id || entry?.id || itemLabel,
        label: itemLabel,
        itemJobId: null,
        state:
          statusFromMediaJobSnapshot(entry) === 'running' ? 'running' : 'done',
      });
    }
  }
  return {
    localId: `restored-${entry?.job_id || entry?.id || newIdentityMediaLocalId()}`,
    assistantId,
    jobId: entry?.job_id ?? entry?.id ?? null,
    title,
    kind,
    items,
    steps,
    status: statusFromMediaJobSnapshot(entry),
    error: entry?.error || entry?.error_message || null,
    cancelling: false,
    previewUrl: null,
    timing: timingFromMediaJobSnapshot(entry),
  };
};

const revokePreviewUrl = (url) => {
  if (typeof url === 'string' && url.startsWith('blob:') && typeof URL !== 'undefined') {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // The URL may already have been revoked.
    }
  }
};

const revokeJobPreviews = (job) => {
  if (!job) return;
  revokePreviewUrl(job.previewUrl);
  for (const item of job.items ?? []) {
    revokePreviewUrl(item.previewUrl);
  }
};

/**
 * Copy filenames from a GET /media_job/{id} snapshot onto a card that was
 * restored from the list (which does not include them).
 *
 * @param {Object} job The stored card.
 * @param {Object} entry A detailed snapshot.
 * @returns {Object}
 */
export const applyMediaSnapshotToPanelJob = (job, entry) => {
  if (!job || !entry) return job;
  const incoming = panelJobFromMediaSnapshot(entry, job.assistantId);
  const incomingHasNames = incoming.items.some(
    (item) => !isGenericMediaLabel(item.label)
  );
  const items = incomingHasNames ? incoming.items : job.items;
  return {
    ...job,
    jobId: job.jobId || incoming.jobId,
    title: isGenericMediaLabel(job.title)
      ? titleFromUploadItems(items, incoming.title)
      : job.title,
    items,
    kind:
      job.kind === 'document' && incoming.kind !== 'document'
        ? incoming.kind
        : job.kind,
    error: job.error || incoming.error,
    timing: mergeMediaJobTiming(job.timing ?? null, incoming.timing),
  };
};

/**
 * Mark running cards whose server job no longer exists as failed.
 *
 * Jobs live in the API process's memory. After a restart GET /media_jobs
 * (with finished jobs included) no longer lists them, so a card still
 * following one is showing a job that will never finish. Cards without a
 * server id (a POST still in flight) are left alone.
 *
 * @param {string} assistantId The avatar whose jobs were listed.
 * @param {Iterable<string>} liveJobIds Server ids the listing returned.
 * @returns {string[]} The cards marked lost.
 */
export const markMissingRunningJobsLost = (assistantId, liveJobIds) => {
  const live = new Set(liveJobIds ?? []);
  const lostLocalIds = [];
  jobs = jobs.map((job) => {
    if (
      job.assistantId !== assistantId ||
      job.status !== 'running' ||
      !job.jobId ||
      live.has(job.jobId)
    ) {
      return job;
    }
    lostLocalIds.push(job.localId);
    return {
      ...job,
      status: 'error',
      error: MEDIA_JOB_LOST_MESSAGE,
      cancelling: false,
      steps: job.steps.map((step) =>
        step.state === 'active' ? { ...step, state: 'error' } : step
      ),
    };
  });
  if (lostLocalIds.length > 0) emit();
  return lostLocalIds;
};

/**
 * Keep the filename and preview from a local card when Settings remounted
 * and restored the same server job without those fields.
 *
 * @param {string} fromLocalId The card that started the upload.
 * @param {string} ontoJobId The server id of the restored card.
 */
export const transferIdentityMediaJobLabels = (fromLocalId, ontoJobId) => {
  const source = findIdentityMediaJob(fromLocalId);
  const target = jobs.find((job) => job.jobId === ontoJobId);
  if (!source || !target) return;
  patchIdentityMediaJob(target.localId, (job) => {
    const sourceHasNames = source.items?.some(
      (item) => !isGenericMediaLabel(item.label)
    );
    const targetNeedsNames = !job.items?.some(
      (item) => !isGenericMediaLabel(item.label)
    );
    return {
      ...job,
      title: isGenericMediaLabel(job.title) ? source.title : job.title,
      items: sourceHasNames && targetNeedsNames ? source.items : job.items,
      previewUrl: job.previewUrl || source.previewUrl,
      kind: job.kind === 'document' && source.kind !== 'document' ? source.kind : job.kind,
    };
  });
  // The restored card now owns any object-URL preview. Clear them here so
  // dropping this card does not revoke the URL the other card is showing.
  patchIdentityMediaJob(fromLocalId, (job) => ({
    ...job,
    previewUrl: null,
    items: (job.items ?? []).map((item) => ({ ...item, previewUrl: null })),
  }));
};

/**
 * @param {Object} job A panel job.
 */
export const addIdentityMediaJob = (job) => {
  jobs = [...jobs, job];
  emit();
};

/**
 * @param {string} localId The card.
 * @param {Function} updater `(job) => nextJob`
 */
export const patchIdentityMediaJob = (localId, updater) => {
  if (!findIdentityMediaJob(localId)) return;
  jobs = jobs.map((job) => (job.localId === localId ? updater(job) : job));
  emit();
};

const forgetDismissTimer = (localId) => {
  const timer = dismissTimerByLocalId.get(localId);
  if (timer) {
    clearTimeout(timer);
    dismissTimerByLocalId.delete(localId);
  }
};

/**
 * Remove a card without remembering its server id. Used when a POST and a
 * /media_jobs restore both created a card for the same job.
 *
 * @param {string} localId The card.
 */
export const dropIdentityMediaJobCard = (localId) => {
  forgetDismissTimer(localId);
  const leaving = jobs.find((candidate) => candidate.localId === localId);
  revokeJobPreviews(leaving);
  jobs = jobs.filter((candidate) => candidate.localId !== localId);
  emit();
};

/**
 * Hide a card and remember its server id so a later /media_jobs read does
 * not put a dismissed finished job back on the screen.
 *
 * @param {string} localId The card.
 */
export const dismissIdentityMediaJob = (localId) => {
  const job = findIdentityMediaJob(localId);
  if (job?.jobId) {
    dismissedJobIds.add(job.jobId);
  }
  dropIdentityMediaJobCard(localId);
};

/**
 * @param {string} localId The card.
 * @param {number} [delayMs]
 */
export const scheduleIdentityMediaJobDismiss = (localId, delayMs = 8000) => {
  forgetDismissTimer(localId);
  const timer = setTimeout(() => {
    dismissTimerByLocalId.delete(localId);
    dismissIdentityMediaJob(localId);
  }, delayMs);
  dismissTimerByLocalId.set(localId, timer);
};

/**
 * @param {string} jobId A server job id.
 * @param {string} [exceptLocalId] A card to ignore (the one that just learned the id).
 * @returns {boolean}
 */
export const storeHasMediaJobId = (jobId, exceptLocalId) => {
  if (!jobId) return false;
  return jobs.some(
    (job) => job.jobId === jobId && job.localId !== exceptLocalId
  );
};

/**
 * Adopt listed jobs that this tab does not already know about.
 *
 * @param {string} assistantId The avatar.
 * @param {Array<Object>} entries GET /media_jobs rows.
 * @returns {{added: number, runningLocalIds: string[]}}
 */
export const adoptListedMediaJobs = (assistantId, entries) => {
  if (!assistantId || !Array.isArray(entries)) {
    return { added: 0, runningLocalIds: [] };
  }
  const runningLocalIds = [];
  const addedLocalIds = [];
  let added = 0;
  for (const entry of entries) {
    const jobId = entry?.job_id ?? entry?.id ?? null;
    if (!jobId) continue;
    if (dismissedJobIds.has(jobId)) continue;
    if (jobs.some((job) => job.jobId === jobId)) continue;
    const entryAssistant = entry.assistant_id ?? entry.assistantId ?? assistantId;
    if (entryAssistant && entryAssistant !== assistantId) continue;
    const panelJob = panelJobFromMediaSnapshot(entry, assistantId);
    jobs = [...jobs, panelJob];
    added += 1;
    addedLocalIds.push(panelJob.localId);
    if (panelJob.status === 'running') {
      runningLocalIds.push(panelJob.localId);
    } else {
      scheduleIdentityMediaJobDismiss(panelJob.localId);
    }
  }
  if (added > 0) emit();
  return { added, addedLocalIds, runningLocalIds };
};
