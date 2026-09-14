import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  NEURAL_DECODER_SOURCE,
  V1_CAMERA_FACING,
  WEBCAM_JPEG_FILENAME,
  appendTrailPoint,
  trailPointFromCurrent,
  webcamJpegFileFromBlob,
} from './linkSimulation.js';

test('trail points ignore a snapshot without finite x and y', () => {
  assert.equal(trailPointFromCurrent(null), null);
  assert.equal(trailPointFromCurrent({ x: 'nope', y: 0.4 }), null);
  assert.deepEqual(trailPointFromCurrent({ x: 0.38, y: 0.9, z: 0 }), {
    x: 0.38,
    y: 0.9,
    z: 0,
  });
});

test('the wrist trail keeps only the most recent points', () => {
  const first = appendTrailPoint([], { x: 0.1, y: 0.2, z: 0 }, 2);
  const second = appendTrailPoint(first, { x: 0.2, y: 0.3, z: 0 }, 2);
  const third = appendTrailPoint(second, { x: 0.3, y: 0.4, z: 0 }, 2);
  assert.equal(third.length, 2);
  assert.equal(third[0].x, 0.2);
  assert.equal(third[1].x, 0.3);
});

test('a V1 still is posted as webcam.jpg, not a new ambient source', () => {
  const file = webcamJpegFileFromBlob(new Blob([Uint8Array.from([0xff, 0xd8])], { type: 'image/jpeg' }));
  assert.equal(file.name, WEBCAM_JPEG_FILENAME);
  assert.equal(file.type, 'image/jpeg');
  assert.equal(NEURAL_DECODER_SOURCE, 'neural_decoder');
  assert.equal(V1_CAMERA_FACING, 'environment');
});
