import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BODY_JOINT_COUNT,
  FACE_POINT_COUNT,
  MotionWindowAccumulator,
  bodyFrameFromLandmarks,
  canonicalizeFace,
  encodeFramesFloat16,
  encodeWithBasis,
  faceFrameFromLandmarks,
  float32ToFloat16Bits,
  headPoseFromMatrix,
  headPoseGeometric,
  coverTransform,
  overlayFrame,
  windowByteLength,
} from './motionWireframe.js';

const syntheticFace = () => {
  const points = [];
  for (let index = 0; index < FACE_POINT_COUNT; index += 1) {
    points.push({ x: 0.4 + ((index * 37) % 100) / 500, y: 0.4 + ((index * 53) % 100) / 500, z: 0 });
  }
  points[33] = { x: 0.4, y: 0.45, z: 0 };
  points[133] = { x: 0.45, y: 0.45, z: 0 };
  points[362] = { x: 0.55, y: 0.45, z: 0 };
  points[263] = { x: 0.6, y: 0.45, z: 0 };
  points[10] = { x: 0.5, y: 0.3, z: 0 };
  points[152] = { x: 0.5, y: 0.7, z: 0 };
  points[1] = { x: 0.5, y: 0.52, z: -0.05 };
  return points;
};

test('float16 encoding round-trips ordinary values within three digits', () => {
  const bits = float32ToFloat16Bits(0.3333);
  assert.equal(bits, 0x3555);
  assert.equal(float32ToFloat16Bits(0), 0);
  assert.equal(float32ToFloat16Bits(-2), 0xc000);
  const bytes = encodeFramesFloat16([new Float32Array([1, -1, 0.5])]);
  assert.deepEqual(Array.from(bytes), [0x00, 0x3c, 0x00, 0xbc, 0x00, 0x38]);
});

test('landmarks flatten into the named layout', () => {
  const body = bodyFrameFromLandmarks(
    Array.from({ length: BODY_JOINT_COUNT }, (_, index) => ({ x: index, y: 2 * index, z: 3 * index, visibility: 0.9 }))
  );
  assert.equal(body.length, BODY_JOINT_COUNT * 4);
  assert.equal(body[11 * 4 + 1], 22);
  assert.ok(Math.abs(body[11 * 4 + 3] - 0.9) < 1e-6);
  assert.equal(bodyFrameFromLandmarks([]), null);
  const face = faceFrameFromLandmarks(syntheticFace());
  assert.equal(face.length, FACE_POINT_COUNT * 3);
});

test('canonicalization removes in-plane rotation and scale', () => {
  const points = syntheticFace();
  const face = faceFrameFromLandmarks(points);
  const canonical = canonicalizeFace(face);
  const angle = (20 * Math.PI) / 180;
  const turned = new Float32Array(face.length);
  for (let index = 0; index < FACE_POINT_COUNT; index += 1) {
    const x = face[index * 3] - 0.5;
    const y = face[index * 3 + 1] - 0.5;
    turned[index * 3] = (x * Math.cos(angle) - y * Math.sin(angle)) * 1.7 + 0.5;
    turned[index * 3 + 1] = (x * Math.sin(angle) + y * Math.cos(angle)) * 1.7 + 0.5;
    turned[index * 3 + 2] = face[index * 3 + 2] * 1.7;
  }
  const turnedCanonical = canonicalizeFace(turned);
  let worst = 0;
  for (let index = 0; index < canonical.length; index += 1) {
    worst = Math.max(worst, Math.abs(canonical[index] - turnedCanonical[index]));
  }
  assert.ok(worst < 1e-3, `worst difference ${worst}`);
  const pose = headPoseGeometric(turned);
  assert.ok(Math.abs(Math.abs(pose[2]) - 20) < 1.5, `roll ${pose[2]}`);
});

test('head pose reads yaw and translation from a column-major matrix', () => {
  const angle = (30 * Math.PI) / 180;
  // Column-major 4x4: columns are the basis vectors, last column the translation.
  const data = [
    Math.cos(angle), Math.sin(angle), 0, 0,
    -Math.sin(angle), Math.cos(angle), 0, 0,
    0, 0, 1, 0,
    1.5, -2, 0, 1,
  ];
  const pose = headPoseFromMatrix({ data, rows: 4, columns: 4 });
  assert.ok(Math.abs(pose[0] - 30) < 1e-3, `yaw ${pose[0]}`);
  assert.ok(Math.abs(pose[3] - 1.5) < 1e-6 && Math.abs(pose[4] + 2) < 1e-6);
  assert.ok(Math.abs(pose[5] - 1) < 1e-6);
});

test('the accumulator paces streams, encodes with a basis, and serializes the API shape', () => {
  const accumulator = new MotionWindowAccumulator({ faceRateHz: 30, bodyRateHz: 15, windowSeconds: 10 });
  const body = bodyFrameFromLandmarks(Array.from({ length: BODY_JOINT_COUNT }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 })));
  const face = faceFrameFromLandmarks(syntheticFace());
  for (let step = 0; step < 30; step += 1) {
    accumulator.push(step * (1000 / 30), { body, face, headPose: null });
  }
  assert.equal(accumulator.face.length, 30);
  assert.equal(accumulator.body.length, 15);
  assert.equal(accumulator.isDue(999), false);
  assert.equal(accumulator.isDue(10_000), true);
  const payload = accumulator.take({ emotion: 'joy' });
  assert.equal(payload.landmark_set_version, 'mediapipe_body33_face478_v1');
  assert.equal(payload.face_encoding, 'dense');
  assert.equal(payload.emotion, 'joy');
  assert.equal(payload.streams.face.values_per_frame, FACE_POINT_COUNT * 3);
  assert.equal(payload.streams.head_pose.frame_count, 30);
  assert.equal(payload.streams.body.frame_count, 15);
  assert.equal(windowByteLength(payload), (30 * 1434 + 30 * 6 + 15 * 132) * 2);
  assert.equal(accumulator.isEmpty, true);

  const width = FACE_POINT_COUNT * 3;
  const basis = {
    basisId: 'b1',
    componentCount: 2,
    width,
    mean: new Float32Array(width),
    components: new Float32Array(2 * width).map((_, index) => (index < width ? 1 : 0)),
  };
  accumulator.setBasis(basis);
  accumulator.push(0, { face, headPose: null });
  const encoded = accumulator.take();
  assert.equal(encoded.face_encoding, 'basis');
  assert.equal(encoded.basis_id, 'b1');
  assert.equal(encoded.streams.face.values_per_frame, 2);
  const coefficients = encodeWithBasis(basis, canonicalizeFace(face));
  assert.equal(coefficients.length, 2);
  assert.equal(coefficients[1], 0);
});

test('the overlay frame keeps every mesh vertex and every joint with its visibility', () => {
  const body = bodyFrameFromLandmarks(
    Array.from({ length: BODY_JOINT_COUNT }, (_, index) => ({
      x: 0.1 * index,
      y: 0.2,
      z: 0,
      visibility: index % 2 ? 0.9 : 0.1,
    }))
  );
  const frame = overlayFrame({ body, face: faceFrameFromLandmarks(syntheticFace()) });
  // The whole mesh, because the mesh is what gets drawn.
  assert.equal(frame.face.length, FACE_POINT_COUNT * 2);
  assert.equal(frame.body.length, BODY_JOINT_COUNT * 3);
  assert.ok(Math.abs(frame.body[11 * 3] - 1.1) < 1e-5);
  assert.ok(frame.body[11 * 3 + 2] > 0.8 && frame.body[12 * 3 + 2] < 0.2);
  assert.deepEqual(overlayFrame({}), { face: null, body: null });
});

test('the cover transform lands normalized coordinates on a cropped preview', () => {
  // A 16:9 frame inside a square tile: cropped left and right, full height.
  const wide = coverTransform({ width: 1280, height: 720 }, { width: 100, height: 100 });
  assert.ok(Math.abs(wide.scale - 100 / 720) < 1e-9);
  assert.ok(wide.offsetY === 0 && wide.offsetX < 0);
  // The centre of the frame stays the centre of the tile.
  assert.ok(Math.abs(wide.offsetX + 0.5 * 1280 * wide.scale - 50) < 1e-6);
  // A 9:16 phone frame in the same tile is cropped top and bottom instead.
  const tall = coverTransform({ width: 720, height: 1280 }, { width: 100, height: 100 });
  assert.ok(tall.offsetX === 0 && tall.offsetY < 0);
  // No frame size yet: never divide by zero.
  assert.ok(Number.isFinite(coverTransform({ width: 0, height: 0 }, { width: 10, height: 10 }).scale));
});
