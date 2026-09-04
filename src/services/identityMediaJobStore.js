// src/services/identityMediaJobStore.js
//
// In-memory identity-media upload cards. Avatar Settings used to hold these
// in React state, so leaving the avatar unmounted the checklist. The store
// outlives that screen. Mapping from GET /media_jobs lives here so tests can
// cover restore without loading the API client.

import {
  applyMediaProgress,
  finalizePipelineSteps,
  stepsForMediaKind,
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
        child.filename ||
        child.url ||
        child.label ||
        child.description ||
        'Item',
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
    entry?.description ||
    entry?.title ||
    entry?.filename ||
    items[0]?.label ||
    'Media upload';
  if (items.length === 0) {
    items.push({
      id: entry?.job_id || entry?.id || title,
      label: title,
      itemJobId: null,
      state: statusFromMediaJobSnapshot(entry) === 'running' ? 'running' : 'done',
    });
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
  };
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
    if (panelJob.status === 'running') {
      runningLocalIds.push(panelJob.localId);
    } else {
      scheduleIdentityMediaJobDismiss(panelJob.localId);
    }
  }
  if (added > 0) emit();
  return { added, runningLocalIds };
};
