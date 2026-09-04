const HOLD_START_MS = 80;
const TARGET_FPS = 30;
const MIN_TAPE_FRAMES = 16;
const MIN_TAPE_FPS = 12;
const MAX_TAPE_FRAMES = 96;
const MAX_TAPE_EDGE = 320;
const MIN_CAPTURE_INTERVAL = 1 / 30;
const MIN_TAPE_SPAN_SECONDS = 0.25;
const TAPE_FIELD = '_idleLoopTape';
const REVERSE_FIELD = '_idleLoopReverseImage';
const CAPTURE_FIELD = '_idleLoopCaptureAttached';
const VIDEO_HOST_ID = 'idle-loop-video-host';

const DEFAULT_TAPE = {
  frames: [],
  capturing: true,
  complete: false,
  decided: false,
  pingPongActive: false,
  pingPongRejected: false,
  reverseStartedAt: null,
  holdingStart: false,
  seekStarted: false,
  scratch: null,
  output: null,
};

export function pingPongMaxFrames(durationSeconds) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return MAX_TAPE_FRAMES;
  }
  return Math.min(
    MAX_TAPE_FRAMES,
    Math.max(MIN_TAPE_FRAMES, Math.round(durationSeconds * TARGET_FPS)),
  );
}

export function pingPongCaptureInterval(durationSeconds, maxFrames) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return MIN_CAPTURE_INTERVAL;
  }
  return Math.max(MIN_CAPTURE_INTERVAL, durationSeconds / Math.max(1, maxFrames));
}

export function meanRgbDistance(first, last) {
  const firstPixels = first?.data || first;
  const lastPixels = last?.data || last;
  if (!firstPixels || !lastPixels) {
    return Infinity;
  }
  const width = first?.width;
  const height = first?.height;
  const size =
    Number.isFinite(width) && Number.isFinite(height)
      ? width * height * 4
      : Math.min(firstPixels.length, lastPixels.length);
  if (!Number.isFinite(size) || size < 4 || firstPixels.length < size || lastPixels.length < size) {
    return Infinity;
  }
  let sum = 0;
  let pixels = 0;
  for (let i = 0; i < size; i += 16) {
    sum +=
      Math.abs(firstPixels[i] - lastPixels[i]) +
      Math.abs(firstPixels[i + 1] - lastPixels[i + 1]) +
      Math.abs(firstPixels[i + 2] - lastPixels[i + 2]);
    pixels += 1;
  }
  return pixels === 0 ? 0 : sum / (pixels * 3);
}

export function tapeSpanSeconds(frames) {
  if (!frames || frames.length < 2) {
    return 0;
  }
  return Math.max(0, frames[frames.length - 1].time - frames[0].time);
}

export function tapeIsUsable(frames, durationSeconds) {
  if (!frames || frames.length < MIN_TAPE_FRAMES) {
    return false;
  }
  const span = tapeSpanSeconds(frames);
  if (span < MIN_TAPE_SPAN_SECONDS) {
    return false;
  }
  if (frames.length / span < MIN_TAPE_FPS) {
    return false;
  }
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return true;
  }
  return span >= Math.min(durationSeconds * 0.75, Math.max(0, durationSeconds - 0.06));
}

export function reverseFrameIndex(elapsedSeconds, spanSeconds, frameCount) {
  if (frameCount <= 1) {
    return 0;
  }
  const span = Math.max(1 / 30, spanSeconds);
  const progress = Math.min(1, Math.max(0, elapsedSeconds / span));
  return Math.min(frameCount - 1, Math.floor((1 - progress) * (frameCount - 1) + 1e-6));
}

export function reverseFrameAtElapsed(frames, elapsedSeconds) {
  if (!frames || frames.length === 0) {
    return 0;
  }
  if (frames.length === 1) {
    return 0;
  }
  const start = frames[0].time;
  const end = frames[frames.length - 1].time;
  const span = Math.max(1 / 30, end - start);
  const target = end - Math.min(span, Math.max(0, elapsedSeconds));
  let best = 0;
  let bestDistance = Infinity;
  for (let index = 0; index < frames.length; index += 1) {
    const distance = Math.abs(frames[index].time - target);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  }
  return best;
}

export function idleLoopUsesNativeLoop(video) {
  return !video?.[TAPE_FIELD]?.pingPongActive;
}

export function idleLoopReverseImage(video) {
  return video?.[REVERSE_FIELD] || null;
}

export function blitIdleLoopReverse(video) {
  const frame = idleLoopReverseImage(video);
  if (!frame) {
    return null;
  }
  const tape = tapeFor(video);
  if (!tape.output) {
    tape.output = document.createElement('canvas');
  }
  const output = tape.output;
  if (output.width !== frame.width || output.height !== frame.height) {
    output.width = frame.width;
    output.height = frame.height;
  }
  const ctx = output.getContext('2d', { alpha: false });
  if (!ctx) {
    return frame;
  }
  ctx.drawImage(frame, 0, 0);
  return output;
}

export function mountIdleLoopVideo(video) {
  if (!video || typeof document === 'undefined' || video.isConnected) {
    return;
  }
  let host = document.getElementById(VIDEO_HOST_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = VIDEO_HOST_ID;
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText =
      'position:fixed;left:0;top:0;width:64px;height:64px;opacity:0.01;overflow:hidden;pointer-events:none;z-index:-1';
    document.body.appendChild(host);
  }
  video.style.cssText = 'width:64px;height:64px;object-fit:cover';
  host.appendChild(video);
}

export function unmountIdleLoopVideo(video) {
  if (video?.parentNode) {
    video.parentNode.removeChild(video);
  }
}

export function attachIdleLoopCapture(video) {
  if (!video || typeof video.requestVideoFrameCallback !== 'function' || video[CAPTURE_FIELD]) {
    return;
  }
  video[CAPTURE_FIELD] = true;
  const onFrame = (_now, metadata) => {
    if (!video[CAPTURE_FIELD]) {
      return;
    }
    recordPresentedFrame(video, metadata?.mediaTime);
    if (video[CAPTURE_FIELD] && video[TAPE_FIELD]?.capturing) {
      video.requestVideoFrameCallback(onFrame);
    }
  };
  video.requestVideoFrameCallback(onFrame);
}

export function disposeIdleLoopTape(video) {
  if (!video) {
    return;
  }
  video[CAPTURE_FIELD] = false;
  delete video[TAPE_FIELD];
  delete video[REVERSE_FIELD];
}

export function idleLoopNeedsPingPong(video) {
  if (!video || !Number.isFinite(video.duration) || video.duration <= 0) {
    return Promise.resolve(false);
  }
  const tape = tapeFor(video);
  if (tape.decided) {
    return Promise.resolve(tape.pingPongActive);
  }
  return Promise.resolve(false);
}

export function stepIdleLoopPingPong(video, _direction, now) {
  if (!video) {
    return 1;
  }

  const tape = tapeFor(video);
  const clock = Number.isFinite(now) ? now : performance.now();
  if (tape.pingPongRejected) {
    video[REVERSE_FIELD] = null;
    return 1;
  }

  if (!video[CAPTURE_FIELD]) {
    recordPresentedFrame(video, video.currentTime);
  }

  if (tape.pingPongActive) {
    if (tape.holdingStart) {
      holdStartFrame(video, tape);
      return 1;
    }
    if (video.ended || video.currentTime >= video.duration - 0.03) {
      return beginReverse(video, tape, clock);
    }
    video[REVERSE_FIELD] = null;
    return 1;
  }

  if (tape.complete && !tape.decided) {
    decidePingPong(video, tape);
  }
  return 1;
}

function tapeFor(video) {
  if (!video[TAPE_FIELD]) {
    video[TAPE_FIELD] = {
      ...DEFAULT_TAPE,
      frames: [],
    };
  }
  return video[TAPE_FIELD];
}

function recordPresentedFrame(video, mediaTime) {
  const tape = tapeFor(video);
  if (!tape.capturing || tape.complete || tape.pingPongRejected) {
    return;
  }
  if (video._idleLoopAllowCapture === false) {
    return;
  }
  if (video.readyState < 2 || video.videoWidth === 0) {
    return;
  }

  const time = Number.isFinite(mediaTime) ? mediaTime : video.currentTime;
  if (!Number.isFinite(time) || time < 0) {
    return;
  }

  const last = tape.frames[tape.frames.length - 1];
  if (last && time + 0.05 < last.time) {
    tape.complete = true;
    tape.capturing = false;
    return;
  }
  if (last && time - last.time < MIN_CAPTURE_INTERVAL) {
    return;
  }

  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  const nearEnd = duration > 0 && time >= duration - 0.05;
  if (tape.frames.length >= pingPongMaxFrames(duration) && !nearEnd) {
    thinTape(tape);
  }

  if (!drawPresentedFrame(video, tape, time)) {
    return;
  }

  if (nearEnd || (duration > 0 && tape.frames.length >= pingPongMaxFrames(duration) && time >= duration * 0.85)) {
    tape.complete = true;
    tape.capturing = false;
  }
}

function thinTape(tape) {
  if (tape.frames.length < 4) {
    return;
  }
  tape.frames = tape.frames.filter((_, index) => index % 2 === 0 || index === tape.frames.length - 1);
}

function drawPresentedFrame(video, tape, time) {
  const edge = Math.min(MAX_TAPE_EDGE, Math.max(video.videoWidth, video.videoHeight) || MAX_TAPE_EDGE);
  const scale = edge / Math.max(video.videoWidth, video.videoHeight);
  const width = Math.max(2, Math.round(video.videoWidth * scale));
  const height = Math.max(2, Math.round(video.videoHeight * scale));

  if (!tape.scratch || tape.scratch.width !== width || tape.scratch.height !== height) {
    tape.scratch = document.createElement('canvas');
    tape.scratch.width = width;
    tape.scratch.height = height;
  }

  const context = tape.scratch.getContext('2d', { willReadFrequently: true, alpha: false });
  if (!context) {
    return false;
  }

  try {
    context.drawImage(video, 0, 0, width, height);
  } catch {
    return false;
  }

  const signature = frameSignature(context, width, height);
  const last = tape.frames[tape.frames.length - 1];
  if (last && last.signature != null && signature != null && last.signature === signature) {
    last.time = time;
    return true;
  }

  const frame = document.createElement('canvas');
  frame.width = width;
  frame.height = height;
  const frameContext = frame.getContext('2d', { alpha: false });
  if (!frameContext) {
    return false;
  }
  frameContext.drawImage(tape.scratch, 0, 0);
  tape.frames.push({ canvas: frame, time, signature });
  return true;
}

function frameSignature(context, width, height) {
  try {
    const sampleWidth = Math.min(width, 48);
    const sampleHeight = Math.min(height, 48);
    const { data } = context.getImageData(0, 0, sampleWidth, sampleHeight);
    let hash = 2166136261;
    for (let i = 0; i < data.length; i += 12) {
      hash ^= data[i] + data[i + 1] * 3 + data[i + 2] * 5;
      hash = Math.imul(hash, 16777619);
    }
    return hash;
  } catch {
    return null;
  }
}

function decidePingPong(video, tape) {
  tape.decided = true;
  if (!tapeIsUsable(tape.frames, video.duration)) {
    tape.rejectReason = 'unusable';
    rejectPingPong(video, tape);
    return;
  }

  const first = pixelsOf(tape.frames[0].canvas);
  const last = pixelsOf(tape.frames[tape.frames.length - 1].canvas);
  const distance = first && last ? meanRgbDistance(first, last) : null;
  tape.seamDistance = distance;
  if (!first || !last || distance <= 8) {
    tape.rejectReason = first && last ? `seam:${distance}` : 'pixels';
    rejectPingPong(video, tape);
    return;
  }

  tape.pingPongActive = true;
  video.loop = false;
}

function rejectPingPong(video, tape) {
  tape.pingPongRejected = true;
  tape.pingPongActive = false;
  tape.capturing = false;
  video.loop = true;
  video[REVERSE_FIELD] = null;
}

function frameImage(frame) {
  return frame?.canvas || frame?.image || null;
}

function beginReverse(video, tape, now) {
  if (tape.reverseStartedAt == null) {
    tape.reverseStartedAt = now;
    video.pause();
  }

  const elapsed = (now - tape.reverseStartedAt) / 1000;
  const index = reverseFrameAtElapsed(tape.frames, elapsed);
  video[REVERSE_FIELD] = frameImage(tape.frames[index]);

  if (index > 0) {
    return -1;
  }

  beginHoldStart(video, tape);
  return 1;
}

function beginHoldStart(video, tape) {
  if (tape.holdingStart) {
    return;
  }
  tape.holdingStart = true;
  tape.seekStarted = false;
  video[REVERSE_FIELD] = frameImage(tape.frames[0]);
}

function holdStartFrame(video, tape) {
  video[REVERSE_FIELD] = frameImage(tape.frames[0]);

  if (!tape.seekStarted) {
    tape.seekStarted = true;
    const onSeeked = () => {
      finishHoldStart(video, tape);
    };
    video.addEventListener('seeked', onSeeked, { once: true });
    try {
      video.currentTime = 0;
    } catch {
      video.removeEventListener('seeked', onSeeked);
      finishHoldStart(video, tape);
      return;
    }
    window.setTimeout(() => {
      if (tape.holdingStart) {
        finishHoldStart(video, tape);
      }
    }, HOLD_START_MS);
  }
}

function finishHoldStart(video, tape) {
  if (!tape.holdingStart) {
    return;
  }
  tape.holdingStart = false;
  tape.reverseStartedAt = null;
  tape.seekStarted = false;
  video[REVERSE_FIELD] = null;
  const playAttempt = video.play();
  if (playAttempt && typeof playAttempt.catch === 'function') {
    playAttempt.catch(() => {});
  }
}

function pixelsOf(canvas) {
  try {
    return canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height) || null;
  } catch {
    return null;
  }
}
