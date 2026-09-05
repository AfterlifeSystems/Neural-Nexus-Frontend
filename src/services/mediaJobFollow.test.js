import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addIdentityMediaJob,
  findIdentityMediaJob,
  markMissingRunningJobsLost,
  panelJobFromMediaSnapshot,
  resetIdentityMediaJobsForTests,
} from './identityMediaJobStore.js';
import { stepsForMediaKind } from './mediaProcessSteps.js';
import { MEDIA_JOB_LOST_MESSAGE } from './mediaJobTiming.js';
import { checkMediaJobOnServer, streamMediaJobOnce } from './mediaJobFollow.js';

const runningCard = (overrides = {}) => ({
  localId: 'card-1',
  assistantId: 'avatar-1',
  jobId: 'job-1',
  title: 'talk.mp4',
  kind: 'voice',
  items: [{ id: 'talk.mp4', label: 'talk.mp4', itemJobId: null, state: 'running' }],
  steps: stepsForMediaKind('voice'),
  status: 'running',
  error: null,
  cancelling: false,
  previewUrl: null,
  timing: null,
  ...overrides,
});

test('a stream that ends with a done frame reports done and records timing', async () => {
  resetIdentityMediaJobsForTests();
  addIdentityMediaJob(runningCard());
  const streamJob = async (jobId, onEvent) => {
    onEvent({ type: 'status', status: 'running', elapsed_seconds: 1, estimated_processing_seconds: 600 });
    onEvent({ type: 'media_progress', stage: 'converting', current: 1, total: 1, elapsed_seconds: 2 });
    onEvent({ type: 'done', status: 'completed', error: null, elapsed_seconds: 3, duration_seconds: 3 });
  };
  const outcome = await streamMediaJobOnce({
    localId: 'card-1',
    jobId: 'job-1',
    streamJob,
    userSignal: new AbortController().signal,
  });
  assert.equal(outcome.ended, 'done');
  assert.equal(outcome.doneFrame.status, 'completed');
  const card = findIdentityMediaJob('card-1');
  assert.equal(card.timing.estimatedProcessingSeconds, 600);
  assert.equal(card.timing.elapsedSeconds, 3);
  assert.equal(card.timing.durationSeconds, 3);
  assert.equal(card.steps.find((step) => step.id === 'convert').state, 'active');
});

test('a stream that closes without a done frame is dropped, not finished', async () => {
  resetIdentityMediaJobsForTests();
  addIdentityMediaJob(runningCard());
  const streamJob = async (jobId, onEvent) => {
    onEvent({ type: 'media_progress', stage: 'converting', current: 1, total: 1 });
    // The API process restarted: the socket closed mid-job.
  };
  const outcome = await streamMediaJobOnce({
    localId: 'card-1',
    jobId: 'job-1',
    streamJob,
    userSignal: new AbortController().signal,
  });
  assert.equal(outcome.ended, 'dropped');
  assert.equal(outcome.doneFrame, null);
  assert.equal(outcome.error, null);
  assert.equal(findIdentityMediaJob('card-1').status, 'running');
});

test('a silent stream is abandoned by the watchdog', async () => {
  resetIdentityMediaJobsForTests();
  addIdentityMediaJob(runningCard());
  const streamJob = (jobId, onEvent, signal) =>
    new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => {
        const abortError = new Error('aborted');
        abortError.name = 'AbortError';
        reject(abortError);
      });
    });
  const outcome = await streamMediaJobOnce({
    localId: 'card-1',
    jobId: 'job-1',
    streamJob,
    userSignal: new AbortController().signal,
    stallTimeoutMs: 20,
  });
  assert.equal(outcome.ended, 'dropped');
  assert.equal(outcome.error, null);
});

test('a network failure on the stream is reported as an error to reconcile', async () => {
  resetIdentityMediaJobsForTests();
  addIdentityMediaJob(runningCard());
  const outcome = await streamMediaJobOnce({
    localId: 'card-1',
    jobId: 'job-1',
    streamJob: async () => {
      throw new TypeError('Failed to fetch');
    },
    userSignal: new AbortController().signal,
  });
  assert.equal(outcome.ended, 'dropped');
  assert.equal(outcome.error.message, 'Failed to fetch');
});

test('a user cancel propagates instead of being reconciled', async () => {
  resetIdentityMediaJobsForTests();
  addIdentityMediaJob(runningCard());
  const userAbort = new AbortController();
  const streamJob = (jobId, onEvent, signal) =>
    new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => {
        const abortError = new Error('aborted');
        abortError.name = 'AbortError';
        reject(abortError);
      });
    });
  const pending = streamMediaJobOnce({
    localId: 'card-1',
    jobId: 'job-1',
    streamJob,
    userSignal: userAbort.signal,
  });
  userAbort.abort();
  await assert.rejects(pending, (error) => error.name === 'AbortError');
});

test('checkMediaJobOnServer maps 404 to lost and other failures to unreachable', async () => {
  resetIdentityMediaJobsForTests();
  addIdentityMediaJob(runningCard());
  const notFound = Object.assign(new Error('Unknown or expired job_id'), { status: 404 });
  assert.equal(
    await checkMediaJobOnServer({ localId: 'card-1', jobId: 'job-1', getJob: async () => { throw notFound; } }),
    'lost'
  );
  assert.equal(
    await checkMediaJobOnServer({ localId: 'card-1', jobId: 'job-1', getJob: async () => { throw new TypeError('Failed to fetch'); } }),
    'unreachable'
  );
});

test('checkMediaJobOnServer reads the job state and records its timing', async () => {
  resetIdentityMediaJobsForTests();
  addIdentityMediaJob(runningCard());
  const check = (snapshot) =>
    checkMediaJobOnServer({ localId: 'card-1', jobId: 'job-1', getJob: async () => snapshot });
  assert.equal(await check({ status: 'running', started_at: 10, estimated_processing_seconds: 600 }), 'running');
  assert.equal(findIdentityMediaJob('card-1').timing.estimatedProcessingSeconds, 600);
  assert.equal(await check({ status: 'completed' }), 'completed');
  assert.equal(await check({ status: 'completed', error: 'partial' }), 'error');
  assert.equal(await check({ status: 'error', error: 'no speech found' }), 'error');
  assert.equal(findIdentityMediaJob('card-1').error, 'no speech found');
  assert.equal(await check({ status: 'cancelled' }), 'cancelled');
  assert.equal(await check({ status: 'queued' }), 'running');
});

test('markMissingRunningJobsLost fails running cards the listing no longer has', () => {
  resetIdentityMediaJobsForTests();
  addIdentityMediaJob(runningCard({ localId: 'gone', jobId: 'job-gone' }));
  addIdentityMediaJob(runningCard({ localId: 'alive', jobId: 'job-alive' }));
  addIdentityMediaJob(runningCard({ localId: 'posting', jobId: null }));
  addIdentityMediaJob(
    runningCard({ localId: 'finished', jobId: 'job-finished', status: 'success' })
  );
  addIdentityMediaJob(
    runningCard({ localId: 'other-avatar', jobId: 'job-other', assistantId: 'avatar-2' })
  );

  const lost = markMissingRunningJobsLost('avatar-1', ['job-alive']);

  assert.deepEqual(lost, ['gone']);
  const goneCard = findIdentityMediaJob('gone');
  assert.equal(goneCard.status, 'error');
  assert.equal(goneCard.error, MEDIA_JOB_LOST_MESSAGE);
  assert.equal(goneCard.steps.find((step) => step.id === 'upload').state, 'error');
  assert.equal(findIdentityMediaJob('alive').status, 'running');
  assert.equal(findIdentityMediaJob('posting').status, 'running');
  assert.equal(findIdentityMediaJob('finished').status, 'success');
  assert.equal(findIdentityMediaJob('other-avatar').status, 'running');
});

test('panelJobFromMediaSnapshot carries the processing-time estimate', () => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const job = panelJobFromMediaSnapshot(
    {
      job_id: 'master-1',
      status: 'running',
      filename: 'talk.mp4',
      started_at: nowSeconds - 60,
      estimated_media_seconds: 2342,
      estimated_processing_seconds: 2342,
    },
    'avatar-1'
  );
  assert.equal(job.timing.estimatedProcessingSeconds, 2342);
  assert.equal(job.timing.estimatedMediaSeconds, 2342);
  assert.ok(job.timing.elapsedSeconds >= 59 && job.timing.elapsedSeconds <= 62);
  const untimed = panelJobFromMediaSnapshot(
    { job_id: 'master-2', status: 'running', filename: 'notes.pdf' },
    'avatar-1'
  );
  assert.equal(untimed.timing, null);
});
