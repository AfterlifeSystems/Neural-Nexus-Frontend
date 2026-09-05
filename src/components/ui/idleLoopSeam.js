const HOLD_START_MS = 80;
const REVERSE_OVERLAY_DELAY_SECONDS = 1 / 30;
const FORWARD_PRESENT_FRAMES = 2;
const TARGET_FPS = 30;
const MIN_TAPE_FRAMES = 4;
const MAX_TAPE_FRAMES = 240;
const MAX_TAPE_EDGE = 512;
const MIN_CAPTURE_INTERVAL = 1 / 30;
const MIN_TAPE_SPAN_SECONDS = 0.2;
const TAPE_FIELD = '_idleLoopTape';
const REVERSE_FIELD = '_idleLoopReverseImage';
const CAPTURE_FIELD = '_idleLoopCaptureAttached';
const REPEAT_FIELD = '_idleLoopRepeat';
const MAX_EDGE_FIELD = '_idleLoopMaxEdge';
const VIDEO_HOST_ID = 'idle-loop-video-host';
// Must stay a painted pixel in the viewport. `opacity: 0`, `visibility:
// hidden`, `display: none`, or `z-index: -1` behind an opaque page all
// count as invisible: Chrome and Firefox suspend the decoder, rVFC
// stops, and both the carousel and voice mode freeze on the last frame.
export const IDLE_LOOP_VIDEO_HOST_STYLE =
  'position:fixed;right:0;bottom:0;width:2px;height:2px;opacity:1;overflow:hidden;pointer-events:none;z-index:2147483647';

const DEFAULT_TAPE = {
  frames: [],
  capturing: true,
  complete: false,
  decided: false,
  armed: false,
  wrapped: false,
  pingPongActive: false,
  pingPongRejected: false,
  reverseStartedAt: null,
  reverseFromTime: null,
  holdingStart: false,
  waitingForForward: false,
  forwardPresentCount: 0,
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

function tapeHasDuration(durationSeconds) {
  return Number.isFinite(durationSeconds) && durationSeconds > 0;
}

export function tapeIsUsable(frames, durationSeconds) {
  if (!frames || frames.length < MIN_TAPE_FRAMES) {
    return false;
  }
  const span = tapeSpanSeconds(frames);
  if (span < MIN_TAPE_SPAN_SECONDS) {
    return false;
  }
  // Duration is often NaN on the first samples. Treating that as "usable"
  // closed the tape after a fraction of a second and reversed a stub.
  if (!tapeHasDuration(durationSeconds)) {
    return false;
  }
  return span >= Math.min(durationSeconds * 0.7, Math.max(0, durationSeconds - 0.12));
}

export function reverseFrameIndex(elapsedSeconds, spanSeconds, frameCount) {
  if (frameCount <= 1) {
    return 0;
  }
  const span = Math.max(1 / 30, spanSeconds);
  const progress = Math.min(1, Math.max(0, elapsedSeconds / span));
  return Math.min(frameCount - 1, Math.floor((1 - progress) * (frameCount - 1) + 1e-6));
}

export function reverseFrameAtElapsed(frames, elapsedSeconds, fromTime) {
  if (!frames || frames.length === 0) {
    return 0;
  }
  if (frames.length === 1) {
    return 0;
  }
  const start = frames[0].time;
  const recordedEnd = frames[frames.length - 1].time;
  const end =
    Number.isFinite(fromTime) && fromTime > start ? fromTime : recordedEnd;
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

export function tapeShouldClose(frames, durationSeconds, time) {
  if (!tapeIsUsable(frames, durationSeconds)) {
    return false;
  }
  return durationSeconds > 0 && time >= durationSeconds - 0.05;
}

export function idleLoopUsesNativeLoop(video) {
  const tape = video?.[TAPE_FIELD];
  if (!tape || tape.pingPongRejected) {
    return true;
  }
  return !tape.armed && !tape.pingPongActive;
}

// Carousel and voice mode share this so React cannot put `loop` back on a
// video the tape has already armed. That wrap wiped the short tape and
// voice mode never reversed.
export function syncIdleLoopPlayback(video, { repeat = true } = {}) {
  if (!video) {
    return;
  }
  video[REPEAT_FIELD] = repeat !== false;
  video.loop = idleLoopUsesNativeLoop(video);
}

export function idleLoopReverseImage(video) {
  return video?.[REVERSE_FIELD] || null;
}

export function blitIdleLoopReverse(video) {
  const frame = idleLoopReverseImage(video);
  if (!frame) {
    return null;
  }
  if (typeof document === 'undefined') {
    return frame;
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
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
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
    document.body.appendChild(host);
  }
  host.style.cssText = IDLE_LOOP_VIDEO_HOST_STYLE;
  video.style.cssText = 'width:2px;height:2px;object-fit:cover';
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

export function handleIdleLoopEnded(video) {
  const tape = video?.[TAPE_FIELD];
  if (tape && !tape.decided && tapeIsUsable(tape.frames, video.duration)) {
    tape.complete = true;
    tape.wrapped = true;
    return;
  }
  if (tape && !tape.decided) {
    const playAttempt = video.play();
    if (playAttempt && typeof playAttempt.catch === 'function') {
      playAttempt.catch(() => {});
    }
  }
}

export function createIdleLoopVideo(
  src,
  { repeat = true, maxEdge = MAX_TAPE_EDGE, onLoaded, onError } = {},
) {
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.autoplay = true;
  video.preload = 'auto';
  video[REPEAT_FIELD] = repeat !== false;
  video[MAX_EDGE_FIELD] = maxEdge;
  video.src = src;
  if (onLoaded) {
    video.addEventListener('loadeddata', onLoaded);
  }
  if (onError) {
    video.addEventListener('error', onError);
  }
  video.addEventListener('ended', () => handleIdleLoopEnded(video));
  mountIdleLoopVideo(video);
  attachIdleLoopCapture(video);
  const playAttempt = video.play();
  if (playAttempt && typeof playAttempt.catch === 'function') {
    playAttempt.catch(() => {});
  }
  return video;
}

export function disposeIdleLoopVideo(video) {
  if (!video) {
    return;
  }
  video.pause();
  disposeIdleLoopTape(video);
  unmountIdleLoopVideo(video);
  video.removeAttribute('src');
  video.load();
}

export function stepIdleLoopMedia(video, direction, now, { repeat = true } = {}) {
  const nextDirection = stepIdleLoopPingPong(video, direction, now);
  syncIdleLoopPlayback(video, { repeat });
  const tape = video?.[TAPE_FIELD];
  const cycleEnded = Boolean(tape?.cycleEnded);
  if (cycleEnded) {
    tape.cycleEnded = false;
  }
  return {
    direction: nextDirection,
    source: blitIdleLoopReverse(video) || video,
    cycleEnded,
  };
}

export function paintIdleLoopFrame(canvas, video) {
  if (!canvas || !video || video.readyState < 2 || video.videoWidth === 0) {
    return false;
  }
  const source = blitIdleLoopReverse(video) || video;
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) {
    return false;
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, width, height);
  return true;
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

  recordPresentedFrame(video, video.currentTime);

  if (tape.complete && !tape.decided) {
    decidePingPong(video, tape);
  }

  if (tape.pingPongActive) {
    if (tape.holdingStart) {
      holdStartFrame(video, tape);
      return 1;
    }
    if (tape.waitingForForward) {
      return holdForwardSeam(video, tape);
    }
    const atStart = video.currentTime < 0.05;
    const atEnd =
      Number.isFinite(video.duration) &&
      video.duration > 0 &&
      video.currentTime >= video.duration - 0.03;
    // Native wrap used to land on frame 0 before reverse started. Play the
    // tape backward from that wrap instead of running the clip forward again.
    if (tape.wrapped) {
      tape.wrapped = false;
      return beginReverse(video, tape, clock);
    }
    // `ended` stays true across a seek-to-zero on some browsers; reversing
    // from the first frame made the loop look a fraction of a second long.
    if (tape.reverseStartedAt != null || (video.ended && !atStart) || atEnd) {
      return beginReverse(video, tape, clock);
    }
    // A hidden or covered video can be paused by the browser mid-pass.
    // Leaving it paused paints the same frame until something else plays it.
    if (video.paused) {
      playQuietly(video);
    }
    video[REVERSE_FIELD] = null;
    return 1;
  }

  if (video.paused && video[REPEAT_FIELD] !== false && !tape.cycleEnded) {
    playQuietly(video);
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

  // rVFC `mediaTime` and `currentTime` drift by a few frames. Mixing them
  // looked like a wrap and wiped the tape every few samples — voice mode
  // never reached a usable reverse. The playhead is the tape clock.
  const time = Number.isFinite(video.currentTime)
    ? video.currentTime
    : mediaTime;
  if (!Number.isFinite(time) || time < 0) {
    return;
  }

  const last = tape.frames[tape.frames.length - 1];
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  if (last && time + 0.2 < last.time) {
    if (tapeIsUsable(tape.frames, duration)) {
      tape.complete = true;
      tape.capturing = false;
      tape.wrapped = true;
      armPingPong(video, tape);
    } else {
      // A seek back to the start before a full play is not a finished cycle.
      tape.frames = [];
      tape.armed = false;
    }
    return;
  }

  const maxFrames = pingPongMaxFrames(duration);
  const interval = pingPongCaptureInterval(duration, maxFrames);
  const nearEnd = duration > 0 && time >= duration - 0.05;
  // `ended` can stay true after a seek-to-zero. Only skip when the playhead
  // itself is frozen on the same sample, or we flood the tape with one frame.
  if (last && time - last.time < 0.001) {
    if (nearEnd && tapeIsUsable(tape.frames, duration)) {
      tape.complete = true;
      tape.capturing = false;
      tape.wrapped = true;
      armPingPong(video, tape);
    }
    return;
  }
  if (last && time - last.time < interval) {
    return;
  }
  if (tape.frames.length >= maxFrames) {
    return;
  }

  if (!drawPresentedFrame(video, tape, time)) {
    return;
  }

  if (tapeCanArm(tape.frames, duration)) {
    armPingPong(video, tape);
  }
  if (tapeShouldClose(tape.frames, duration, time)) {
    tape.complete = true;
    tape.capturing = false;
  }
}

function tapeEdge(video) {
  const requested = Number(video?.[MAX_EDGE_FIELD]);
  if (Number.isFinite(requested) && requested >= 64) {
    return Math.min(1024, requested);
  }
  return MAX_TAPE_EDGE;
}

function drawPresentedFrame(video, tape, time) {
  const edge = Math.min(tapeEdge(video), Math.max(video.videoWidth, video.videoHeight) || MAX_TAPE_EDGE);
  const scale = edge / Math.max(video.videoWidth, video.videoHeight);
  const width = Math.max(2, Math.round(video.videoWidth * scale));
  const height = Math.max(2, Math.round(video.videoHeight * scale));

  if (!tape.scratch || tape.scratch.width !== width || tape.scratch.height !== height) {
    tape.scratch = document.createElement('canvas');
    tape.scratch.width = width;
    tape.scratch.height = height;
  }

  const context = tape.scratch.getContext('2d', { alpha: false });
  if (!context) {
    return false;
  }

  try {
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(video, 0, 0, width, height);
  } catch {
    return false;
  }

  const frame = document.createElement('canvas');
  frame.width = width;
  frame.height = height;
  const frameContext = frame.getContext('2d', { alpha: false });
  if (!frameContext) {
    return false;
  }
  frameContext.drawImage(tape.scratch, 0, 0);
  tape.frames.push({ canvas: frame, time });
  return true;
}

function tapeCanArm(frames, durationSeconds) {
  // Arming sets loop=false. Doing that at 35% ended the clip early, the
  // wrap cleared the short tape, and voice mode never reversed.
  return tapeIsUsable(frames, durationSeconds);
}

function armPingPong(video, tape) {
  if (tape.armed || tape.pingPongRejected) {
    return;
  }
  tape.armed = true;
  video.loop = false;
}

function decidePingPong(video, tape) {
  tape.decided = true;
  if (!tapeIsUsable(tape.frames, video.duration)) {
    tape.rejectReason = 'unusable';
    rejectPingPong(video, tape);
    return;
  }

  // Always reverse after the last frame. Native wrap-to-start is a jump even
  // when the ends are close, and a matching seam still looks better played
  // forward then back than snapped to frame 0.
  const first = pixelsOf(tape.frames[0].canvas);
  const last = pixelsOf(tape.frames[tape.frames.length - 1].canvas);
  tape.seamDistance = first && last ? meanRgbDistance(first, last) : null;
  tape.pingPongActive = true;
  armPingPong(video, tape);
  video.loop = false;
}

function rejectPingPong(video, tape) {
  tape.pingPongRejected = true;
  tape.pingPongActive = false;
  tape.armed = false;
  tape.capturing = false;
  video.loop = video[REPEAT_FIELD] !== false;
  video[REVERSE_FIELD] = null;
  if (video.loop) {
    const playAttempt = video.play();
    if (playAttempt && typeof playAttempt.catch === 'function') {
      playAttempt.catch(() => {});
    }
  }
}

function frameImage(frame) {
  return frame?.canvas || frame?.image || null;
}

function beginReverse(video, tape, now) {
  if (tape.reverseStartedAt == null) {
    tape.reverseStartedAt = now;
    video.pause();
    // Exact last presented pixels, so the first reverse overlay matches the
    // paused video instead of a tape frame from a few ticks ago.
    freezePresentedFrame(video, tape);
    const lastTime = tape.frames[tape.frames.length - 1]?.time ?? 0;
    const liveTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    tape.reverseFromTime = Math.max(lastTime, liveTime);
    if (duration > 0 && liveTime >= duration - 0.08) {
      tape.reverseFromTime = Math.max(tape.reverseFromTime, duration);
    }
  }

  const elapsed = (now - tape.reverseStartedAt) / 1000;
  // Keep the paused live frame on screen for one tick so the swap onto the
  // reverse tape is not a resolution/color pop.
  if (elapsed < REVERSE_OVERLAY_DELAY_SECONDS) {
    video[REVERSE_FIELD] = null;
    return -1;
  }
  const index = reverseFrameAtElapsed(
    tape.frames,
    elapsed,
    tape.reverseFromTime,
  );
  video[REVERSE_FIELD] = frameImage(tape.frames[index]);

  if (index > 0) {
    return -1;
  }

  // A one-shot emotion clip: one forward play plus this reverse, then stop.
  // Neutral idle keeps repeating via beginHoldStart.
  if (video[REPEAT_FIELD] === false) {
    tape.cycleEnded = true;
    tape.reverseStartedAt = null;
    video.pause();
    return 1;
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
    globalThis.setTimeout(() => {
      if (!tape.holdingStart) {
        return;
      }
      if (video.currentTime >= 0.08) {
        try {
          video.currentTime = 0;
        } catch {
          finishHoldStart(video, tape);
          return;
        }
        globalThis.setTimeout(() => {
          if (tape.holdingStart) {
            finishHoldStart(video, tape);
          }
        }, HOLD_START_MS);
        return;
      }
      finishHoldStart(video, tape);
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
  tape.waitingForForward = true;
  tape.forwardPresentCount = 0;
  video[REVERSE_FIELD] = frameImage(tape.frames[0]);
  playQuietly(video);
}

function playQuietly(video) {
  const playAttempt = video.play();
  if (playAttempt && typeof playAttempt.catch === 'function') {
    playAttempt.catch(() => {});
  }
}

function releaseForwardSeam(video, tape) {
  tape.waitingForForward = false;
  tape.forwardPresentCount = 0;
  video[REVERSE_FIELD] = null;
}

function holdForwardSeam(video, tape) {
  video[REVERSE_FIELD] = frameImage(tape.frames[0]);
  if (video.paused) {
    playQuietly(video);
  }
  const atStart = video.currentTime < 0.08;
  const playing = !video.paused && video.readyState >= 2;
  if (!playing) {
    return 1;
  }
  if (!atStart) {
    // Keyframe seek or a dropped frame skipped the 0–80ms window. The
    // live video is already past frame 0; keeping this overlay looks frozen.
    releaseForwardSeam(video, tape);
    return 1;
  }
  tape.forwardPresentCount += 1;
  if (tape.forwardPresentCount >= FORWARD_PRESENT_FRAMES) {
    releaseForwardSeam(video, tape);
  }
  return 1;
}

function freezePresentedFrame(video, tape) {
  if (typeof document === 'undefined') {
    return;
  }
  if (video.readyState < 2 || video.videoWidth === 0) {
    return;
  }
  const last = tape.frames[tape.frames.length - 1];
  const time = Number.isFinite(video.currentTime)
    ? video.currentTime
    : last?.time ?? 0;
  if (last && Math.abs(time - last.time) < MIN_CAPTURE_INTERVAL) {
    return;
  }
  drawPresentedFrame(video, tape, time);
}

function pixelsOf(canvas) {
  try {
    return canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height) || null;
  } catch {
    return null;
  }
}
