import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PORTRAIT_LOOP_TOTAL,
  PORTRAIT_STILL_TOTAL,
  applyMediaProgress,
  finalizePipelineSteps,
  isGenericMediaLabel,
  mergeUploadItems,
  pipelineProgress,
  stepsForMediaKind,
  titleFromUploadItems,
} from './mediaProcessSteps.js';

const portrait = () => stepsForMediaKind('portrait');

const counts = (steps) =>
  Object.fromEntries(
    steps.map((step) => [
      step.id,
      `${step.state}:${step.current}/${step.total}`,
    ])
  );

test('portrait pipeline starts every step at 0/N', () => {
  const steps = portrait();
  assert.deepEqual(
    steps.map((step) => [step.id, step.label, step.current, step.total, step.state]),
    [
      ['upload', 'Uploading portrait', 0, 1, 'active'],
      ['convert', 'Converting portrait', 0, 1, 'pending'],
      ['stills', 'Creating avatar portraits', 0, PORTRAIT_STILL_TOTAL, 'pending'],
      [
        'loops',
        'Creating avatar emotion videos',
        0,
        PORTRAIT_LOOP_TOTAL,
        'pending',
      ],
    ]
  );
});

test('convert progress does not drop portraits or emotion videos', () => {
  const steps = portrait();
  applyMediaProgress(steps, {
    stage: 'upload',
    current: 1,
    total: 1,
  });
  applyMediaProgress(steps, { stage: 'converting_started', total: 1 });
  applyMediaProgress(steps, { stage: 'converting', current: 1, total: 1 });

  assert.equal(steps.length, 4);
  assert.deepEqual(counts(steps), {
    upload: 'done:1/1',
    convert: 'active:1/1',
    stills: 'pending:0/6',
    loops: 'pending:0/7',
  });
});

test('portrait and loop counts fill in place and stay on the list', () => {
  const steps = portrait();
  applyMediaProgress(steps, { stage: 'upload', current: 1, total: 1 });
  applyMediaProgress(steps, { stage: 'converting', current: 1, total: 1 });
  applyMediaProgress(steps, { stage: 'emotion_stills', current: 0, total: 6 });
  applyMediaProgress(steps, { stage: 'emotion_stills', current: 3, total: 6 });

  assert.deepEqual(counts(steps), {
    upload: 'done:1/1',
    convert: 'done:1/1',
    stills: 'active:3/6',
    loops: 'pending:0/7',
  });

  applyMediaProgress(steps, { stage: 'emotion_stills', current: 6, total: 6 });
  applyMediaProgress(steps, { stage: 'idle_loops', current: 0, total: 7 });
  applyMediaProgress(steps, { stage: 'idle_loops', current: 4, total: 7 });

  assert.equal(steps.find((step) => step.id === 'stills').state, 'done');
  assert.deepEqual(counts(steps), {
    upload: 'done:1/1',
    convert: 'done:1/1',
    stills: 'done:6/6',
    loops: 'active:4/7',
  });

  applyMediaProgress(steps, { stage: 'idle_loops', current: 7, total: 7 });
  applyMediaProgress(steps, { stage: 'emotion_media_complete', complete: true });
  applyMediaProgress(steps, { stage: 'converting_complete', indexed: 1 });

  assert.deepEqual(counts(steps), {
    upload: 'done:1/1',
    convert: 'done:1/1',
    stills: 'done:6/6',
    loops: 'done:7/7',
  });
  assert.equal(finalizePipelineSteps(steps, 'portrait'), false);
});

test('finalizing a portrait job does not complete unseen stills or loops', () => {
  const steps = portrait();
  applyMediaProgress(steps, { stage: 'upload', current: 1, total: 1 });
  applyMediaProgress(steps, { stage: 'converting', current: 1, total: 1 });
  applyMediaProgress(steps, { stage: 'converting_complete', indexed: 1 });

  const unfinished = finalizePipelineSteps(steps, 'portrait');
  assert.equal(unfinished, true);
  assert.deepEqual(counts(steps), {
    upload: 'done:1/1',
    convert: 'done:1/1',
    stills: 'pending:0/6',
    loops: 'pending:0/7',
  });
});

test('pipelineProgress weights each checklist step equally', () => {
  const steps = stepsForMediaKind('document');
  assert.equal(pipelineProgress(steps).percent, 0);
  applyMediaProgress(steps, { stage: 'upload', current: 1, total: 1 });
  assert.equal(pipelineProgress(steps).percent, 33);
  assert.match(pipelineProgress(steps).label, /Converting/);
});

test('mergeUploadItems stamps child job ids and appends playlist children', () => {
  const started = [{ id: 'https://youtu.be/list', label: 'https://youtu.be/list' }];
  const withChild = mergeUploadItems(started, {
    stage: 'playlist_child_added',
    item_job_id: 'child-1',
    item_filename: 'Video one',
  });
  assert.equal(withChild.length, 2);
  assert.equal(withChild[1].itemJobId, 'child-1');
  const stamped = mergeUploadItems(started, {
    stage: 'converting',
    item_job_id: 'item-9',
    filename: 'https://youtu.be/list',
  });
  assert.equal(stamped[0].itemJobId, 'item-9');
});

test('titleFromUploadItems prefers a real filename over Media upload', () => {
  assert.equal(isGenericMediaLabel('Media upload'), true);
  assert.equal(isGenericMediaLabel('notes.pdf'), false);
  assert.equal(
    titleFromUploadItems(
      [{ label: 'Media upload' }, { label: 'notes.pdf' }],
      'Media upload'
    ),
    'notes.pdf'
  );
});

test('mergeUploadItems replaces a generic Media upload placeholder', () => {
  const started = [
    { id: 'job-1', label: 'Media upload', itemJobId: null, state: 'running' },
  ];
  const named = mergeUploadItems(started, {
    stage: 'converting',
    item_job_id: 'child-1',
    item_filename: 'notes.pdf',
  });
  assert.equal(named.length, 1);
  assert.equal(named[0].label, 'notes.pdf');
  assert.equal(named[0].itemJobId, 'child-1');
});

test('voice pipeline collects speech, then indexes the transcript', () => {
  const steps = stepsForMediaKind('voice');
  assert.deepEqual(
    steps.map((step) => [step.id, step.label]),
    [
      ['upload', 'Uploading'],
      ['convert', 'Converting'],
      ['voice', 'Building the voice model'],
      ['index', 'Adding to memory'],
    ]
  );
  applyMediaProgress(steps, { stage: 'upload', current: 1, total: 1 });
  applyMediaProgress(steps, { stage: 'converting', current: 1, total: 1 });
  applyMediaProgress(steps, {
    stage: 'voice_clip_collected',
    seconds: 42,
    collected_seconds: 42,
  });
  const voiceStep = steps.find((step) => step.id === 'voice');
  assert.notEqual(voiceStep.state, 'pending');
  applyMediaProgress(steps, { stage: 'indexing', current: 1, total: 1 });
  assert.equal(steps.find((step) => step.id === 'index').state, 'done');
});
