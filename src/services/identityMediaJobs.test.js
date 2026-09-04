import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  adoptListedMediaJobs,
  addIdentityMediaJob,
  dismissIdentityMediaJob,
  kindFromMediaJobSnapshot,
  listStoredIdentityMediaJobs,
  mediaJobEntriesFromListResponse,
  panelJobFromMediaSnapshot,
  patchIdentityMediaJob,
  resetIdentityMediaJobsForTests,
  statusFromMediaJobSnapshot,
  storeHasMediaJobId,
  subscribeIdentityMediaJobs,
} from './identityMediaJobStore.js';

test('mediaJobEntriesFromListResponse unwraps jobs, items, or a bare array', () => {
  const row = { job_id: 'j1' };
  assert.deepEqual(mediaJobEntriesFromListResponse([row]), [row]);
  assert.deepEqual(mediaJobEntriesFromListResponse({ jobs: [row] }), [row]);
  assert.deepEqual(mediaJobEntriesFromListResponse({ items: [row] }), [row]);
  assert.deepEqual(mediaJobEntriesFromListResponse({ media_jobs: [row] }), [row]);
  assert.deepEqual(mediaJobEntriesFromListResponse(null), []);
  assert.deepEqual(mediaJobEntriesFromListResponse({}), []);
});

test('kindFromMediaJobSnapshot reads flags and description text', () => {
  assert.equal(kindFromMediaJobSnapshot({ reference_image: true }), 'portrait');
  assert.equal(kindFromMediaJobSnapshot({ is_reference_audio: true }), 'voice');
  assert.equal(
    kindFromMediaJobSnapshot({ description: 'Creating the avatar portrait' }),
    'portrait'
  );
  assert.equal(kindFromMediaJobSnapshot({ filename: 'notes.pdf' }), 'document');
});

test('statusFromMediaJobSnapshot maps queued, done, failed, cancelled', () => {
  assert.equal(statusFromMediaJobSnapshot({ status: 'queued' }), 'running');
  assert.equal(statusFromMediaJobSnapshot({ status: 'running' }), 'running');
  assert.equal(statusFromMediaJobSnapshot({ status: 'done' }), 'success');
  assert.equal(
    statusFromMediaJobSnapshot({ status: 'done', error: 'nope' }),
    'error'
  );
  assert.equal(statusFromMediaJobSnapshot({ state: 'failed' }), 'error');
  assert.equal(statusFromMediaJobSnapshot({ status: 'cancelled' }), 'cancelled');
});

test('panelJobFromMediaSnapshot keeps the checklist and child items', () => {
  const job = panelJobFromMediaSnapshot(
    {
      job_id: 'master-1',
      status: 'running',
      description: 'talk.mp4',
      stage: 'converting',
      current: 1,
      total: 1,
      children: [
        { job_id: 'child-1', filename: 'talk.mp4', status: 'running' },
      ],
    },
    'avatar-9'
  );
  assert.equal(job.assistantId, 'avatar-9');
  assert.equal(job.jobId, 'master-1');
  assert.equal(job.title, 'talk.mp4');
  assert.equal(job.status, 'running');
  assert.equal(job.kind, 'document');
  assert.equal(job.items[0].itemJobId, 'child-1');
  assert.equal(job.steps.find((step) => step.id === 'upload').state, 'done');
  assert.equal(job.steps.find((step) => step.id === 'convert').state, 'active');
  assert.equal(job.steps.find((step) => step.id === 'index').state, 'pending');
});

test('stored jobs survive a subscriber leaving (Settings unmount)', () => {
  resetIdentityMediaJobsForTests();
  const seen = [];
  const stop = subscribeIdentityMediaJobs(() => {
    seen.push(listStoredIdentityMediaJobs('avatar-1').length);
  });
  addIdentityMediaJob({
    localId: 'local-1',
    assistantId: 'avatar-1',
    jobId: 'job-1',
    title: 'face.png',
    kind: 'portrait',
    items: [
      { id: 'face.png', label: 'face.png', itemJobId: null, state: 'running' },
    ],
    steps: [],
    status: 'running',
    error: null,
    cancelling: false,
  });
  assert.deepEqual(seen, [1]);
  stop();
  patchIdentityMediaJob('local-1', (job) => ({
    ...job,
    status: 'running',
    title: 'face.png · converting',
  }));
  assert.equal(listStoredIdentityMediaJobs('avatar-1').length, 1);
  assert.equal(
    listStoredIdentityMediaJobs('avatar-1')[0].title,
    'face.png · converting'
  );
  const afterReturn = listStoredIdentityMediaJobs('avatar-1');
  assert.equal(afterReturn[0].jobId, 'job-1');
  assert.equal(afterReturn[0].status, 'running');
});

test('adoptListedMediaJobs restores a missing card and skips known or dismissed ids', () => {
  resetIdentityMediaJobsForTests();
  const first = adoptListedMediaJobs('avatar-1', [
    {
      job_id: 'job-restore',
      assistant_id: 'avatar-1',
      status: 'running',
      description: 'clip.mp3',
      is_reference_audio: true,
    },
  ]);
  assert.equal(first.added, 1);
  assert.equal(first.runningLocalIds.length, 1);
  const stored = listStoredIdentityMediaJobs('avatar-1');
  assert.equal(stored.length, 1);
  assert.equal(stored[0].jobId, 'job-restore');
  assert.equal(stored[0].kind, 'voice');
  assert.equal(stored[0].status, 'running');
  assert.equal(storeHasMediaJobId('job-restore'), true);
  assert.equal(storeHasMediaJobId('job-restore', stored[0].localId), false);

  const addedAgain = adoptListedMediaJobs('avatar-1', [
    { job_id: 'job-restore', status: 'running', description: 'clip.mp3' },
  ]);
  assert.equal(addedAgain.added, 0);
  assert.equal(listStoredIdentityMediaJobs('avatar-1').length, 1);

  dismissIdentityMediaJob(stored[0].localId);
  assert.equal(listStoredIdentityMediaJobs('avatar-1').length, 0);

  const afterDismiss = adoptListedMediaJobs('avatar-1', [
    { job_id: 'job-restore', status: 'done', description: 'clip.mp3' },
  ]);
  assert.equal(afterDismiss.added, 0);
  assert.equal(listStoredIdentityMediaJobs('avatar-1').length, 0);
});
