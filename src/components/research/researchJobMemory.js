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
