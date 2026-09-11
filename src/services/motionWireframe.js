/**
 * The wireframe over the person, in the browser — pure logic, no DOM.
 *
 * MediaPipe's PoseLandmarker and FaceLandmarker run on the live webcam and
 * hand this module their landmarks. It turns them into the same named
 * coordinates the API writes every other source against
 * (src/anubis/utils/motion/landmarks.py on the API side): 33 body joints with
 * x, y, z and visibility; the 478-point face mesh, with the head's rigid motion
 * removed so what is left is expression; and the head pose itself. A window of
 * a few seconds is quantized to little-endian float16 and rides the ambient
 * observation the browser already sends — no extra request.
 *
 * Once the API has fitted the avatar's own expression basis, the browser
 * projects each face frame onto it and sends coefficients instead of the
 * dense mesh: a few dozen values a frame rather than 1,434, so a continuous
 * camera costs about 40 KB per ten-second window on the wire. Until then the
 * dense mesh is sent, only during that bounded bootstrap.
 *
 * Nothing here decides *whose* movement this is. The API's identity gate does
 * that, against the reference image, before a window is attributed.
 */

export const LANDMARK_SET_VERSION = 'mediapipe_body33_face478_v1';
export const BODY_JOINT_COUNT = 33;
export const BODY_VALUES_PER_JOINT = 4;
export const FACE_POINT_COUNT = 478;
export const FACE_VALUES_PER_POINT = 3;
export const HEAD_POSE_VALUES = 6;

export const FACE_ENCODING_DENSE = 'dense';
export const FACE_ENCODING_BASIS = 'basis';

// Mesh indices that fix the face's own frame of reference (subject's own left / right).
const LEFT_EYE_OUTER = 263;
const RIGHT_EYE_OUTER = 33;
const LEFT_EYE_INNER = 362;
const RIGHT_EYE_INNER = 133;
const CHIN = 152;
const FOREHEAD = 10;
const MIN_SCALE = 1e-4;

/**
 * Flatten pose landmarks into `[33 * 4]` (x, y, z, visibility).
 * @param {Array<{x:number,y:number,z:number,visibility?:number}>} landmarks
 * @returns {Float32Array|null}
 */
export function bodyFrameFromLandmarks(landmarks) {
  if (!landmarks || landmarks.length !== BODY_JOINT_COUNT) return null;
  const frame = new Float32Array(BODY_JOINT_COUNT * BODY_VALUES_PER_JOINT);
  for (let index = 0; index < BODY_JOINT_COUNT; index += 1) {
    const point = landmarks[index];
    const offset = index * BODY_VALUES_PER_JOINT;
    frame[offset] = point.x;
    frame[offset + 1] = point.y;
    frame[offset + 2] = point.z ?? 0;
    frame[offset + 3] = point.visibility ?? 0;
  }
  return frame;
}

/**
 * Flatten face landmarks into `[478 * 3]`.
 * @param {Array<{x:number,y:number,z:number}>} landmarks
 * @returns {Float32Array|null}
 */
export function faceFrameFromLandmarks(landmarks) {
  if (!landmarks || landmarks.length !== FACE_POINT_COUNT) return null;
  const frame = new Float32Array(FACE_POINT_COUNT * FACE_VALUES_PER_POINT);
  for (let index = 0; index < FACE_POINT_COUNT; index += 1) {
    const point = landmarks[index];
    const offset = index * FACE_VALUES_PER_POINT;
    frame[offset] = point.x;
    frame[offset + 1] = point.y;
    frame[offset + 2] = point.z ?? 0;
  }
  return frame;
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => Math.sqrt(dot(a, a));
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const point = (frame, index) => [
  frame[index * 3],
  frame[index * 3 + 1],
  frame[index * 3 + 2],
];

/**
 * Centre, rotation rows and scale that put a face into its own forward frame.
 * Mirrors `_face_frame_axes` on the API side exactly, so a residual encoded
 * here decodes against a basis fitted there.
 */
function faceFrameAxes(frame) {
  const leftEye = point(frame, LEFT_EYE_OUTER).map(
    (value, axis) => (value + point(frame, LEFT_EYE_INNER)[axis]) / 2
  );
  const rightEye = point(frame, RIGHT_EYE_OUTER).map(
    (value, axis) => (value + point(frame, RIGHT_EYE_INNER)[axis]) / 2
  );
  const centre = leftEye.map((value, axis) => (value + rightEye[axis]) / 2);
  let xAxis = sub(leftEye, rightEye);
  const interOcular = norm(xAxis);
  if (interOcular < MIN_SCALE) {
    return { centre, rotation: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], scale: 1 };
  }
  xAxis = xAxis.map((value) => value / interOcular);
  let down = sub(point(frame, CHIN), point(frame, FOREHEAD));
  const projection = dot(down, xAxis);
  down = down.map((value, axis) => value - projection * xAxis[axis]);
  const downNorm = norm(down);
  const yAxis = downNorm < MIN_SCALE ? [0, 1, 0] : down.map((value) => value / downNorm);
  let zAxis = cross(xAxis, yAxis);
  const zNorm = norm(zAxis);
  zAxis = zNorm < MIN_SCALE ? [0, 0, 1] : zAxis.map((value) => value / zNorm);
  return { centre, rotation: [xAxis, yAxis, zAxis], scale: interOcular };
}

/**
 * Remove rigid head motion from one mesh frame: centred between the eyes,
 * unit inter-ocular scale, eye line as x, forehead-to-chin as y.
 * @param {Float32Array} frame `[478 * 3]`
 * @returns {Float32Array} the expression residual, `[478 * 3]`
 */
export function canonicalizeFace(frame) {
  const { centre, rotation, scale } = faceFrameAxes(frame);
  const out = new Float32Array(FACE_POINT_COUNT * FACE_VALUES_PER_POINT);
  for (let index = 0; index < FACE_POINT_COUNT; index += 1) {
    const local = sub(point(frame, index), centre).map((value) => value / scale);
    out[index * 3] = dot(local, rotation[0]);
    out[index * 3 + 1] = dot(local, rotation[1]);
    out[index * 3 + 2] = dot(local, rotation[2]);
  }
  return out;
}

const degrees = (radians) => (radians * 180) / Math.PI;

/**
 * Yaw, pitch, roll (degrees), tx, ty, scale from MediaPipe's 4x4 facial
 * transformation matrix (column-major, as the JS task returns it).
 * @param {{data: ArrayLike<number>, rows?: number, columns?: number}|ArrayLike<number>} matrix
 * @returns {Float32Array} `[6]`
 */
export function headPoseFromMatrix(matrix) {
  const data = matrix?.data ?? matrix;
  if (!data || data.length < 16) return null;
  // MediaPipe JS returns the matrix column-major: element (row, col) is data[col * 4 + row].
  const at = (row, col) => data[col * 4 + row];
  const rotation = [
    [at(0, 0), at(0, 1), at(0, 2)],
    [at(1, 0), at(1, 1), at(1, 2)],
    [at(2, 0), at(2, 1), at(2, 2)],
  ];
  const determinant =
    rotation[0][0] * (rotation[1][1] * rotation[2][2] - rotation[1][2] * rotation[2][1]) -
    rotation[0][1] * (rotation[1][0] * rotation[2][2] - rotation[1][2] * rotation[2][0]) +
    rotation[0][2] * (rotation[1][0] * rotation[2][1] - rotation[1][1] * rotation[2][0]);
  const scale = Math.cbrt(Math.abs(determinant)) || 1;
  const m = rotation.map((row) => row.map((value) => value / scale));
  const sy = Math.max(-1, Math.min(1, -m[2][0]));
  const pitch = Math.asin(sy);
  let yaw;
  let roll;
  if (Math.abs(Math.cos(pitch)) > 1e-6) {
    yaw = Math.atan2(m[1][0], m[0][0]);
    roll = Math.atan2(m[2][1], m[2][2]);
  } else {
    yaw = Math.atan2(-m[0][1], m[1][1]);
    roll = 0;
  }
  return new Float32Array([degrees(yaw), degrees(pitch), degrees(roll), at(0, 3), at(1, 3), scale]);
}

/**
 * Estimate the head pose from the mesh alone, for a task that returned no matrix.
 * @param {Float32Array} frame `[478 * 3]`
 */
export function headPoseGeometric(frame) {
  const { centre, rotation, scale } = faceFrameAxes(frame);
  const roll = degrees(Math.atan2(rotation[0][1], rotation[0][0]));
  const nose = sub(point(frame, 1), centre);
  const localX = dot(nose, rotation[0]);
  const yaw = degrees(Math.atan2(localX, (scale > MIN_SCALE ? scale : 1) * 0.9));
  const verticalSpan = norm(sub(point(frame, CHIN), point(frame, FOREHEAD))) || 1;
  const noseFraction = dot(sub(point(frame, 1), point(frame, FOREHEAD)), rotation[1]) / verticalSpan;
  const pitch = degrees(((noseFraction - 0.55) * Math.PI) / 2);
  return new Float32Array([yaw, pitch, roll, centre[0], centre[1], scale > MIN_SCALE ? scale : 1]);
}

// --- float16 ----------------------------------------------------------------

/**
 * Round-to-nearest-even float32 → float16 bits.
 * @param {number} value
 * @returns {number} 16-bit pattern
 */
export function float32ToFloat16Bits(value) {
  const floatView = new Float32Array(1);
  const intView = new Uint32Array(floatView.buffer);
  floatView[0] = value;
  const x = intView[0];
  const sign = (x >>> 16) & 0x8000;
  let exponent = ((x >>> 23) & 0xff) - 127 + 15;
  let mantissa = x & 0x7fffff;
  if (((x >>> 23) & 0xff) === 0xff) {
    return sign | 0x7c00 | (mantissa ? 0x200 : 0);
  }
  if (exponent >= 0x1f) return sign | 0x7c00;
  if (exponent <= 0) {
    if (exponent < -10) return sign;
    mantissa |= 0x800000;
    const shift = 14 - exponent;
    let half = mantissa >>> shift;
    const remainder = mantissa & ((1 << shift) - 1);
    const halfway = 1 << (shift - 1);
    if (remainder > halfway || (remainder === halfway && (half & 1))) half += 1;
    return sign | half;
  }
  let half = sign | (exponent << 10) | (mantissa >>> 13);
  const remainder = mantissa & 0x1fff;
  if (remainder > 0x1000 || (remainder === 0x1000 && (half & 1))) half += 1;
  return half;
}

/**
 * Encode `[frames][values]` float32 rows as little-endian float16 bytes.
 * @param {Float32Array[]} rows
 * @returns {Uint8Array}
 */
export function encodeFramesFloat16(rows) {
  if (!rows.length) return new Uint8Array(0);
  const width = rows[0].length;
  const out = new Uint8Array(rows.length * width * 2);
  const view = new DataView(out.buffer);
  let offset = 0;
  for (const row of rows) {
    for (let index = 0; index < width; index += 1) {
      view.setUint16(offset, float32ToFloat16Bits(row[index]), true);
      offset += 2;
    }
  }
  return out;
}

/**
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function bytesToBase64(bytes) {
  if (typeof btoa === 'function') {
    let binary = '';
    const chunk = 0x8000;
    for (let index = 0; index < bytes.length; index += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(index, index + chunk));
    }
    return btoa(binary);
  }
  // Node (tests).
  // eslint-disable-next-line no-undef
  return Buffer.from(bytes).toString('base64');
}

// --- the basis, in the browser --------------------------------------------

/**
 * Decode the basis `GET /avatar_motion_basis` returns into typed arrays.
 * @param {{basis_id:string, component_count:number, mean_b64:string, components_b64:string}} payload
 */
export function decodeBasis(payload) {
  const toFloat32 = (b64) => {
    const binary = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary'); // eslint-disable-line no-undef
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
  };
  const mean = toFloat32(payload.mean_b64);
  const components = toFloat32(payload.components_b64);
  const componentCount = payload.component_count;
  return {
    basisId: payload.basis_id,
    landmarkSetVersion: payload.landmark_set_version,
    componentCount,
    width: mean.length,
    mean,
    components,
  };
}

/**
 * Project one residual onto the basis → `[componentCount]` coefficients.
 * @param {{mean:Float32Array, components:Float32Array, componentCount:number, width:number}} basis
 * @param {Float32Array} residual
 */
export function encodeWithBasis(basis, residual) {
  const { mean, components, componentCount, width } = basis;
  const centred = new Float32Array(width);
  for (let index = 0; index < width; index += 1) centred[index] = residual[index] - mean[index];
  const out = new Float32Array(componentCount);
  for (let component = 0; component < componentCount; component += 1) {
    let sum = 0;
    const base = component * width;
    for (let index = 0; index < width; index += 1) sum += centred[index] * components[base + index];
    out[component] = sum;
  }
  return out;
}

// --- windows ----------------------------------------------------------------

/**
 * Accumulate frames into a window and serialize it in the shape the API parses
 * (`window_from_payload`). One accumulator per capture session.
 */
export class MotionWindowAccumulator {
  /**
   * @param {{faceRateHz:number, bodyRateHz:number, windowSeconds:number, basis?:object|null, source?:string}} options
   */
  constructor({ faceRateHz, bodyRateHz, windowSeconds, basis = null, source = 'live_camera' }) {
    this.faceRateHz = faceRateHz;
    this.bodyRateHz = bodyRateHz;
    this.windowSeconds = windowSeconds;
    this.basis = basis;
    this.source = source;
    this.reset();
  }

  reset() {
    this.body = [];
    this.face = [];
    this.head = [];
    this.startedAt = null;
    this.lastFaceAt = -Infinity;
    this.lastBodyAt = -Infinity;
  }

  setBasis(basis) {
    // A basis change mid-window would mix encodings; start a fresh window.
    if ((basis?.basisId ?? null) !== (this.basis?.basisId ?? null)) this.reset();
    this.basis = basis;
  }

  get isEmpty() {
    return !this.body.length && !this.face.length;
  }

  /** Whether enough time has passed to flush a window. */
  isDue(now) {
    return this.startedAt != null && now - this.startedAt >= this.windowSeconds * 1000;
  }

  /** Whether a face frame is wanted at this instant (paces to the face rate). */
  wantsFace(now) {
    return now - this.lastFaceAt >= 1000 / this.faceRateHz - 1;
  }

  wantsBody(now) {
    return now - this.lastBodyAt >= 1000 / this.bodyRateHz - 1;
  }

  /**
   * @param {number} now ms
   * @param {{body?:Float32Array|null, face?:Float32Array|null, headPose?:Float32Array|null}} frames raw (image-space) frames
   */
  push(now, { body = null, face = null, headPose = null }) {
    if (this.startedAt == null) this.startedAt = now;
    if (body && this.wantsBody(now)) {
      this.body.push(body);
      this.lastBodyAt = now;
    }
    if (face && this.wantsFace(now)) {
      const residual = canonicalizeFace(face);
      this.face.push(this.basis ? encodeWithBasis(this.basis, residual) : residual);
      this.head.push(headPose ?? headPoseGeometric(face));
      this.lastFaceAt = now;
    }
  }

  /**
   * Serialize and reset. Returns `null` when nothing was captured.
   * @param {{emotion?:string, capturedAt?:string, speech?:Array}} [extra]
   */
  take({ emotion = 'neutral', capturedAt = new Date().toISOString(), speech = [] } = {}) {
    if (this.isEmpty) {
      this.reset();
      return null;
    }
    const streams = {};
    if (this.body.length) {
      streams.body = {
        sample_rate_hz: this.bodyRateHz,
        frame_count: this.body.length,
        values_per_frame: BODY_JOINT_COUNT * BODY_VALUES_PER_JOINT,
        data_b64: bytesToBase64(encodeFramesFloat16(this.body)),
      };
    }
    let faceEncoding = 'none';
    if (this.face.length) {
      const width = this.basis ? this.basis.componentCount : FACE_POINT_COUNT * FACE_VALUES_PER_POINT;
      faceEncoding = this.basis ? FACE_ENCODING_BASIS : FACE_ENCODING_DENSE;
      streams.face = {
        sample_rate_hz: this.faceRateHz,
        frame_count: this.face.length,
        values_per_frame: width,
        data_b64: bytesToBase64(encodeFramesFloat16(this.face)),
      };
      streams.head_pose = {
        sample_rate_hz: this.faceRateHz,
        frame_count: this.head.length,
        values_per_frame: HEAD_POSE_VALUES,
        data_b64: bytesToBase64(encodeFramesFloat16(this.head)),
      };
    }
    const payload = {
      schema_version: 1,
      landmark_set_version: LANDMARK_SET_VERSION,
      source: this.source,
      emotion,
      captured_at: capturedAt,
      face_encoding: faceEncoding,
      basis_id: this.basis?.basisId ?? null,
      speech,
      streams,
    };
    this.reset();
    return payload;
  }
}

/**
 * Decide the wire size of a window before sending it, so an oversized dense
 * window is decimated rather than dropped.
 * @param {{streams: Record<string, {frame_count:number, values_per_frame:number}>}} payload
 */
export function windowByteLength(payload) {
  return Object.values(payload?.streams ?? {}).reduce(
    (total, stream) => total + stream.frame_count * stream.values_per_frame * 2,
    0
  );
}

/**
 * The 2-D points to draw as the overlay: body joints with visibility, and a
 * sparse set of face points (eyes, brows, nose, mouth) so the sketch stays
 * legible at tile size.
 * @param {{body?:Float32Array|null, face?:Float32Array|null}} frames
 * @returns {{x:number,y:number,kind:'body'|'face'}[]} normalized image coordinates
 */
export function overlayPoints({ body = null, face = null }) {
  const points = [];
  if (body) {
    for (let index = 0; index < BODY_JOINT_COUNT; index += 1) {
      const offset = index * BODY_VALUES_PER_JOINT;
      if (body[offset + 3] >= 0.5) points.push({ x: body[offset], y: body[offset + 1], kind: 'body' });
    }
  }
  if (face) {
    for (const index of FACE_OVERLAY_INDICES) {
      points.push({ x: face[index * 3], y: face[index * 3 + 1], kind: 'face' });
    }
  }
  return points;
}

export const FACE_OVERLAY_INDICES = [
  1, 4, 6, 10, 13, 14, 33, 61, 70, 105, 107, 133, 145, 152, 159, 173, 234, 263, 291,
  300, 334, 336, 362, 374, 386, 398, 454,
];

export const BODY_OVERLAY_EDGES = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24],
  [0, 11], [0, 12], [9, 10], [2, 5],
];
