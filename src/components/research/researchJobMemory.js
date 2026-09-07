// src/components/research/researchJobMemory.js
//
// The running research job, remembered per avatar in localStorage, so a page
// reload keeps following the research that was already started rather than
// losing the progress until the job finishes.

const RESEARCH_JOB_STORAGE_PREFIX = 'neural_nexus_research_job:';

/**
 * Remember the running job for an avatar.
 *
 * @param {string} assistantId The avatar.
 * @param {string} jobId The research job.
 */
export function rememberResearchJob(assistantId, jobId) {
  if (!assistantId || !jobId) return;
  try {
    window.localStorage.setItem(
      `${RESEARCH_JOB_STORAGE_PREFIX}${assistantId}`,
      jobId
    );
  } catch {
    // Storage is a convenience; the review list works without it.
  }
}

/**
 * The remembered running job for an avatar.
 *
 * @param {string} assistantId The avatar.
 * @returns {string|null} The job id, or null when none was remembered.
 */
export function readRememberedResearchJob(assistantId) {
  try {
    return window.localStorage.getItem(
      `${RESEARCH_JOB_STORAGE_PREFIX}${assistantId}`
    );
  } catch {
    return null;
  }
}

/**
 * Forget the remembered job once the research has finished.
 *
 * @param {string} assistantId The avatar.
 */
export function forgetResearchJob(assistantId) {
  try {
    window.localStorage.removeItem(
      `${RESEARCH_JOB_STORAGE_PREFIX}${assistantId}`
    );
  } catch {
    // Nothing to clean up when storage is unavailable.
  }
}

/**
 * The research job this avatar is actually running, if any.
 *
 * The panel holds the job it started in component state and the browser
 * remembers one job per avatar. Neither alone is enough: state survives an
 * avatar switch (and must not be followed under the new avatar), and the
 * remembered id survives a reload (and must be followed when state is empty).
 *
 * @param {Object} parameters
 * @param {{assistantId: string, id: string}|null} parameters.job The job this panel started.
 * @param {string} parameters.assistantId The avatar the panel is showing now.
 * @param {string|null} parameters.rememberedJobId What the browser remembered for that avatar.
 * @returns {string|null} The job to follow, or null when this avatar has none.
 */
export function activeResearchJobIdFor({ job, assistantId, rememberedJobId }) {
  if (!assistantId) return null;
  if (job && job.assistantId === assistantId && job.id) return job.id;
  return rememberedJobId || null;
}
