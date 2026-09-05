import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  adoptListedMediaJobs,
  addIdentityMediaJob,
  applyMediaSnapshotToPanelJob,
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
  transferIdentityMediaJobLabels,
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
  // Speech uploads carry no reference flag: the audio/video filename marks them.
  assert.equal(kindFromMediaJobSnapshot({ filename: 'Mom.m4a' }), 'voice');
  assert.equal(
    kindFromMediaJobSnapshot({ children: [{ filename: 'talk.mp4' }] }),
    'voice'
  );
  assert.equal(
    kindFromMediaJobSnapshot({
      children: [{ filename: 'talk.mp4' }, { filename: 'notes.pdf' }],
    }),
    'document'
  );
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
  // A video upload is speech: the restored card is the voice card, whose
  // checklist still ends with indexing.
  assert.equal(job.kind, 'voice');
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

test('panelJobFromMediaSnapshot does not invent a Media upload label', () => {
  const job = panelJobFromMediaSnapshot(
    { job_id: 'listed-1', status: 'running', assistant_id: 'avatar-1' },
    'avatar-1'
  );
  assert.equal(job.title, 'Document upload');
  assert.equal(job.items.length, 0);
});

test('panelJobFromMediaSnapshot titles the card from child filenames', () => {
  const job = panelJobFromMediaSnapshot(
    {
      job_id: 'master-2',
      status: 'running',
      children: [{ job_id: 'child-2', filename: 'vacation.jpg', status: 'running' }],
    },
    'avatar-1'
  );
  assert.equal(job.title, 'vacation.jpg');
  assert.equal(job.items[0].label, 'vacation.jpg');
});

test('applyMediaSnapshotToPanelJob fills a list-restored card from GET /media_job', () => {
  const listed = panelJobFromMediaSnapshot(
    { job_id: 'job-9', status: 'running' },
    'avatar-1'
  );
  const filled = applyMediaSnapshotToPanelJob(listed, {
    job_id: 'job-9',
    status: 'running',
    children: [{ job_id: 'child-9', filename: 'notes.pdf', status: 'running' }],
  });
  assert.equal(filled.title, 'notes.pdf');
  assert.equal(filled.items[0].label, 'notes.pdf');
  assert.equal(filled.localId, listed.localId);
});

test('transferIdentityMediaJobLabels keeps the local filename on the restored card', () => {
  resetIdentityMediaJobsForTests();
  addIdentityMediaJob({
    localId: 'local-upload',
    assistantId: 'avatar-1',
    jobId: null,
    title: 'face.png',
    kind: 'document',
    items: [
      { id: 'face.png', label: 'face.png', itemJobId: null, state: 'running' },
    ],
    steps: [],
    status: 'running',
    error: null,
    cancelling: false,
    previewUrl: null,
  });
  addIdentityMediaJob({
    localId: 'restored-job-8',
    assistantId: 'avatar-1',
    jobId: 'job-8',
    title: 'Document upload',
    kind: 'document',
    items: [],
    steps: [],
    status: 'running',
    error: null,
    cancelling: false,
    previewUrl: null,
  });
  transferIdentityMediaJobLabels('local-upload', 'job-8');
  const restored = listStoredIdentityMediaJobs('avatar-1').find(
    (job) => job.jobId === 'job-8'
  );
  assert.equal(restored.title, 'face.png');
  assert.equal(restored.items[0].label, 'face.png');
});

test('a list-restored card plus GET /media_job snapshot names the file', () => {
  resetIdentityMediaJobsForTests();
  const { addedLocalIds } = adoptListedMediaJobs('avatar-1', [
    { job_id: 'job-9', assistant_id: 'avatar-1', status: 'running' },
  ]);
  assert.equal(addedLocalIds.length, 1);
  const listed = listStoredIdentityMediaJobs('avatar-1')[0];
  assert.equal(listed.title, 'Document upload');
  patchIdentityMediaJob(listed.localId, (job) =>
    applyMediaSnapshotToPanelJob(job, {
      job_id: 'job-9',
      status: 'running',
      children: [{ job_id: 'child-1', filename: 'notes.pdf', status: 'running' }],
    })
  );
  assert.equal(listStoredIdentityMediaJobs('avatar-1')[0].title, 'notes.pdf');
});
