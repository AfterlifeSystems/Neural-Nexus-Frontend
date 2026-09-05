import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  IDLE_LOOP_VIDEO_HOST_STYLE,
  idleLoopReverseImage,
  idleLoopUsesNativeLoop,
  meanRgbDistance,
  pingPongCaptureInterval,
  pingPongMaxFrames,
  handleIdleLoopEnded,
  reverseFrameAtElapsed,
  reverseFrameIndex,
  stepIdleLoopMedia,
  stepIdleLoopPingPong,
  syncIdleLoopPlayback,
  tapeIsUsable,
  tapeShouldClose,
  tapeSpanSeconds,
} from './idleLoopSeam.js';

function makeVideo(duration) {
  let time = 0;
  let paused = false;
  let ended = false;
  const listeners = new Map();
  return {
    duration,
    get currentTime() {
      return time;
    },
    set currentTime(value) {
      time = value;
      ended = value >= duration - 0.001;
      for (const listener of listeners.get('seeked') ?? []) listener();
    },
    get paused() {
      return paused;
    },
    get ended() {
      return ended;
    },
    videoWidth: 32,
    videoHeight: 32,
    readyState: 4,
    loop: false,
    play() {
      paused = false;
      ended = false;
      return Promise.resolve();
    },
    pause() {
      paused = true;
    },
    addEventListener(name, listener) {
      const bucket = listeners.get(name) ?? [];
      bucket.push(listener);
      listeners.set(name, bucket);
    },
    removeEventListener(name, listener) {
      const bucket = listeners.get(name) ?? [];
      listeners.set(
        name,
        bucket.filter((entry) => entry !== listener),
      );
    },
  };
}

function paintTape(video, duration, count) {
  const frames = [];
  for (let index = 0; index < count; index += 1) {
    frames.push({
      time: (index / (count - 1)) * duration,
      image: { width: 32, height: 32 },
    });
  }
  video._idleLoopTape = {
    frames,
    capturing: false,
    complete: true,
    decided: true,
    armed: true,
    wrapped: false,
    pingPongActive: true,
    pingPongRejected: false,
    reverseStartedAt: null,
    holdingStart: false,
    waitingForForward: false,
    seekStarted: false,
    scratch: null,
  };
}

test('the idle-loop host stays a painted pixel so decoders are not suspended', () => {
  const style = IDLE_LOOP_VIDEO_HOST_STYLE;
  assert.doesNotMatch(style, /z-index\s*:\s*-/);
  assert.doesNotMatch(style, /opacity\s*:\s*0/);
  assert.doesNotMatch(style, /visibility\s*:\s*hidden/);
  assert.doesNotMatch(style, /display\s*:\s*none/);
  assert.match(style, /opacity\s*:\s*1/);
});

test('meanRgbDistance compares image pixels, not array metadata', () => {
  const red = {
    width: 2,
    height: 2,
    data: Uint8ClampedArray.from([
      255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255,
    ]),
  };
  const blue = {
    width: 2,
    height: 2,
    data: Uint8ClampedArray.from([
      0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255,
    ]),
  };
  assert.equal(meanRgbDistance(red, red), 0);
  assert.ok(meanRgbDistance(red, blue) > 8);
});

test('reverse starts on the last tape frame and ends on the first', () => {
  const frames = 17;
  const span = 1;
  assert.equal(reverseFrameIndex(0, span, frames), frames - 1);
  assert.equal(reverseFrameIndex(span, span, frames), 0);
  assert.equal(reverseFrameIndex(span / 2, span, frames), 8);
});

test('wall-clock reverse finishes in the tape span when frames drop', () => {
  const span = 1;
  const frames = 18;
  const start = 1_000;
  const nowAtRealtimeEnd = start + 1_000;
  const elapsed = (nowAtRealtimeEnd - start) / 1000;
  assert.equal(reverseFrameIndex(elapsed, span, frames), 0);

  // Previous path added min(0.05, dt) per rAF. At 10fps that is half speed,
  // so after 1s of wall time the playhead is still in the middle.
  const legacyElapsed = 10 * 0.05;
  assert.notEqual(reverseFrameIndex(legacyElapsed, span, frames), 0);
});

test('tape span is last minus first media time', () => {
  assert.equal(tapeSpanSeconds([]), 0);
  assert.equal(tapeSpanSeconds([{ time: 0.1 }]), 0);
  assert.equal(tapeSpanSeconds([{ time: 0.1 }, { time: 2.1 }]), 2);
});

test('a sparse tape over a long clip is not usable for reverse', () => {
  const frames = [0, 0.04, 0.08, 0.12, 0.16, 0.2].map((time) => ({ time }));
  assert.equal(tapeIsUsable(frames, 4), false);
});

test('a tape that covers most of the clip is usable', () => {
  const frames = [];
  for (let index = 0; index < 40; index += 1) {
    frames.push({ time: (index / 39) * 2 });
  }
  assert.equal(tapeIsUsable(frames, 2.1), true);
});

test('a tape that only covers the start of a long clip is not usable', () => {
  const frames = [];
  for (let index = 0; index < 20; index += 1) {
    frames.push({ time: (index / 19) * 0.3 });
  }
  assert.equal(tapeIsUsable(frames, 2.1), false);
});

test('a finished tape always reverses', () => {
  const video = makeVideo(1);
  video.loop = true;
  video._idleLoopTape = {
    frames: Array.from({ length: 20 }, (_, index) => ({
      time: index / 19,
      image: { width: 32, height: 32 },
    })),
    capturing: false,
    complete: true,
    decided: false,
    armed: false,
    wrapped: false,
    pingPongActive: false,
    pingPongRejected: false,
    reverseStartedAt: null,
    holdingStart: false,
    seekStarted: false,
    scratch: null,
  };
  video.currentTime = 0.5;
  stepIdleLoopPingPong(video, 1, 0);
  assert.equal(video._idleLoopTape.pingPongActive, true);
  assert.equal(video.loop, false);
  assert.equal(idleLoopUsesNativeLoop(video), false);
});

test('a wrap after a full tape starts reverse immediately', () => {
  const duration = 2;
  const video = makeVideo(duration);
  video.loop = true;
  video._idleLoopTape = {
    frames: Array.from({ length: 40 }, (_, index) => ({
      time: (index / 39) * duration,
      image: { width: 32, height: 32 },
    })),
    capturing: true,
    complete: false,
    decided: false,
    armed: false,
    wrapped: false,
    pingPongActive: false,
    pingPongRejected: false,
    reverseStartedAt: null,
    holdingStart: false,
    seekStarted: false,
    scratch: null,
  };
  video.currentTime = 0;
  const direction = stepIdleLoopPingPong(video, 1, 0);
  assert.equal(video._idleLoopTape.pingPongActive, true);
  assert.equal(direction, -1);
  assert.equal(video.paused, true);
});

test('twelve unique frames a second over the clip is usable', () => {
  const frames = [];
  for (let index = 0; index < 24; index += 1) {
    frames.push({ time: (index / 23) * 2 });
  }
  assert.equal(tapeIsUsable(frames, 2.05), true);
});

test('frame budget covers the full clip at thirty frames a second', () => {
  assert.equal(pingPongMaxFrames(2), 60);
  assert.equal(pingPongMaxFrames(4), 120);
  assert.equal(pingPongMaxFrames(8), 240);
  assert.equal(pingPongMaxFrames(20), 240);
});

test('capture interval stays at thirty frames a second for short clips', () => {
  assert.equal(pingPongCaptureInterval(2, 60), 1 / 30);
  assert.ok(pingPongCaptureInterval(20, 240) > 1 / 30);
});

test('the tape stays open until the last frames of the clip', () => {
  const frames = [];
  for (let index = 0; index < 40; index += 1) {
    frames.push({ time: (index / 39) * 4 });
  }
  assert.equal(tapeShouldClose(frames, 5, 4), false);
  assert.equal(tapeShouldClose(frames, 5, 4.96), true);
});

test('reverse follows recorded media time, not a uniform index', () => {
  const frames = [0, 0.1, 0.2, 0.9, 1].map((time) => ({ time }));
  assert.equal(reverseFrameAtElapsed(frames, 0), 4);
  assert.equal(reverseFrameAtElapsed(frames, 0.15), 3);
  assert.equal(reverseFrameAtElapsed(frames, 1), 0);
});

test('reverse lasts the live clip when the tape ends a little early', () => {
  const frames = [0, 0.25, 0.5, 0.75, 1].map((time) => ({ time }));
  assert.equal(reverseFrameAtElapsed(frames, 0, 1.2), 4);
  assert.equal(reverseFrameAtElapsed(frames, 0.2, 1.2), 4);
  assert.equal(reverseFrameAtElapsed(frames, 1.2, 1.2), 0);
});

test('reverse at 10fps lasts the clip, not twice the clip', () => {
  const duration = 1;
  const video = makeVideo(duration);
  paintTape(video, duration, 16);
  video.currentTime = 0.97;

  let direction = stepIdleLoopPingPong(video, 1, 0);
  assert.equal(direction, -1);

  for (let tick = 1; tick <= 10; tick += 1) {
    direction = stepIdleLoopPingPong(video, direction, tick * 100);
  }
  assert.equal(
    direction,
    1,
    'wall-clock reverse must finish after 1s even when frames arrive every 100ms'
  );
});

test('a one-shot clip stops after reverse instead of restarting', () => {
  const duration = 1;
  const video = makeVideo(duration);
  paintTape(video, duration, 16);
  video._idleLoopRepeat = false;
  video.currentTime = 0.97;

  let direction = stepIdleLoopPingPong(video, 1, 0);
  for (let tick = 1; tick <= 10; tick += 1) {
    direction = stepIdleLoopPingPong(video, direction, tick * 100);
  }
  assert.equal(video._idleLoopTape.cycleEnded, true);
  assert.equal(video.paused, true);
  assert.equal(direction, 1);
});

test('a tape shorter than most of the clip is not usable', () => {
  const frames = [];
  for (let index = 0; index < 20; index += 1) {
    frames.push({ time: (index / 19) * 0.4 });
  }
  assert.equal(tapeIsUsable(frames, 6), false);
  assert.equal(tapeIsUsable(frames, 0), false);
});

test('a frozen last frame does not flood the tape', () => {
  const video = makeVideo(1);
  video._idleLoopTape = {
    frames: [
      { time: 0 },
      { time: 0.97 },
    ],
    capturing: true,
    complete: false,
    decided: false,
    armed: false,
    wrapped: false,
    pingPongActive: false,
    pingPongRejected: false,
    reverseStartedAt: null,
    holdingStart: false,
    seekStarted: false,
    scratch: null,
  };
  video.currentTime = 0.97;
  stepIdleLoopPingPong(video, 1, 0);
  stepIdleLoopPingPong(video, 1, 16);
  stepIdleLoopPingPong(video, 1, 32);
  assert.equal(video._idleLoopTape.frames.length, 2);
  assert.equal(video._idleLoopTape.complete, false);
});

test('a small playhead jitter is not treated as a wrap', () => {
  const video = makeVideo(2);
  video._idleLoopTape = {
    frames: [
      { time: 0.4 },
      { time: 0.5 },
    ],
    capturing: true,
    complete: false,
    decided: false,
    armed: false,
    wrapped: false,
    pingPongActive: false,
    pingPongRejected: false,
    reverseStartedAt: null,
    holdingStart: false,
    seekStarted: false,
    scratch: null,
  };
  video.currentTime = 0.47;
  stepIdleLoopPingPong(video, 1, 0);
  assert.equal(video._idleLoopTape.frames.length, 2);
  assert.equal(video._idleLoopTape.complete, false);
});

test('rewinding before a full cycle does not complete a short tape', () => {
  const video = makeVideo(6);
  video._idleLoopTape = {
    frames: Array.from({ length: 20 }, (_, index) => ({
      time: 0.04 * (index + 1),
    })),
    capturing: true,
    complete: false,
    decided: false,
    armed: false,
    wrapped: false,
    pingPongActive: false,
    pingPongRejected: false,
    reverseStartedAt: null,
    holdingStart: false,
    seekStarted: false,
    scratch: null,
  };
  video.currentTime = 0;
  stepIdleLoopPingPong(video, 1, 0);
  assert.equal(video._idleLoopTape.complete, false);
  assert.equal(video._idleLoopTape.capturing, true);
  assert.equal(video._idleLoopTape.frames.length, 0);
});

test('the first reverse tick keeps the paused live frame', () => {
  const duration = 1;
  const video = makeVideo(duration);
  paintTape(video, duration, 16);
  video.currentTime = 0.97;
  const direction = stepIdleLoopPingPong(video, 1, 0);
  assert.equal(direction, -1);
  assert.equal(video.paused, true);
  assert.equal(idleLoopReverseImage(video), null);
});

test('reverse overlay stays up until the start frame has been presented', () => {
  const duration = 1;
  const video = makeVideo(duration);
  paintTape(video, duration, 16);
  video.currentTime = 0.97;
  stepIdleLoopPingPong(video, 1, 0);
  stepIdleLoopPingPong(video, -1, 50);
  let direction = 1;
  for (let tick = 1; tick <= 10; tick += 1) {
    direction = stepIdleLoopPingPong(video, direction, tick * 100);
  }
  assert.equal(video._idleLoopTape.holdingStart || video._idleLoopTape.waitingForForward, true);
  stepIdleLoopPingPong(video, direction, 1100);
  assert.equal(video._idleLoopTape.waitingForForward, true);
  assert.ok(idleLoopReverseImage(video));
  stepIdleLoopPingPong(video, 1, 1116);
  stepIdleLoopPingPong(video, 1, 1132);
  assert.equal(video._idleLoopTape.waitingForForward, false);
  assert.equal(idleLoopReverseImage(video), null);
});

test('reverse overlay lifts when the playhead skips the start window', () => {
  const duration = 1;
  const video = makeVideo(duration);
  paintTape(video, duration, 16);
  video.currentTime = 0.97;
  stepIdleLoopPingPong(video, 1, 0);
  stepIdleLoopPingPong(video, -1, 50);
  let direction = 1;
  for (let tick = 1; tick <= 10; tick += 1) {
    direction = stepIdleLoopPingPong(video, direction, tick * 100);
  }
  stepIdleLoopPingPong(video, direction, 1100);
  assert.equal(video._idleLoopTape.waitingForForward, true);
  video.currentTime = 0.2;
  video.play();
  stepIdleLoopPingPong(video, 1, 1116);
  assert.equal(video._idleLoopTape.waitingForForward, false);
  assert.equal(idleLoopReverseImage(video), null);
  assert.equal(video.paused, false);
});

test('a paused first pass is resumed before the tape is armed', () => {
  const video = makeVideo(2);
  video.loop = true;
  video.currentTime = 0.3;
  video.pause();
  video._idleLoopTape = {
    frames: [],
    capturing: false,
    complete: false,
    decided: false,
    armed: false,
    wrapped: false,
    pingPongActive: false,
    pingPongRejected: false,
    reverseStartedAt: null,
    holdingStart: false,
    seekStarted: false,
    scratch: null,
  };
  stepIdleLoopPingPong(video, 1, 0);
  assert.equal(video.paused, false);
});

test('a paused forward pass is resumed instead of holding a still', () => {
  const duration = 1;
  const video = makeVideo(duration);
  paintTape(video, duration, 16);
  video.currentTime = 0.4;
  video.pause();
  const direction = stepIdleLoopPingPong(video, 1, 0);
  assert.equal(direction, 1);
  assert.equal(video.paused, false);
  assert.equal(video._idleLoopTape.reverseStartedAt, null);
});

test('playback sync matches the carousel: React cannot restore native loop once armed', () => {
  const video = makeVideo(2);
  video.loop = true;
  syncIdleLoopPlayback(video, { repeat: true });
  assert.equal(video.loop, true);
  assert.equal(video._idleLoopRepeat, true);

  video._idleLoopTape = {
    frames: [],
    armed: true,
    pingPongActive: false,
    pingPongRejected: false,
  };
  video.loop = true;
  syncIdleLoopPlayback(video, { repeat: true });
  assert.equal(video.loop, false);

  video._idleLoopTape.pingPongRejected = true;
  syncIdleLoopPlayback(video, { repeat: true });
  assert.equal(video.loop, true);

  video._idleLoopTape.pingPongRejected = false;
  video._idleLoopTape.armed = false;
  video._idleLoopTape.pingPongActive = true;
  syncIdleLoopPlayback(video, { repeat: false });
  assert.equal(video.loop, false);
  assert.equal(video._idleLoopRepeat, false);
});

test('ended with a usable tape arms reverse instead of restarting', () => {
  const video = makeVideo(2);
  video._idleLoopTape = {
    frames: Array.from({ length: 20 }, (_, index) => ({
      time: (index / 19) * 2,
    })),
    decided: false,
    complete: false,
    wrapped: false,
  };
  handleIdleLoopEnded(video);
  assert.equal(video._idleLoopTape.complete, true);
  assert.equal(video._idleLoopTape.wrapped, true);
});

test('stepIdleLoopMedia reports a finished one-shot cycle once', () => {
  const video = makeVideo(1);
  paintTape(video, 1, 16);
  video._idleLoopRepeat = false;
  video.currentTime = 0.97;
  stepIdleLoopMedia(video, 1, 0, { repeat: false });
  let last = null;
  for (let tick = 1; tick <= 10; tick += 1) {
    last = stepIdleLoopMedia(video, -1, tick * 100, { repeat: false });
  }
  assert.equal(last.cycleEnded, true);
  const again = stepIdleLoopMedia(video, 1, 1100, { repeat: false });
  assert.equal(again.cycleEnded, false);
});

test('ended at time zero does not start reverse', () => {
  const duration = 6;
  const video = makeVideo(duration);
  paintTape(video, duration, 40);
  video.currentTime = 0;
  Object.defineProperty(video, 'ended', { get: () => true });
  const direction = stepIdleLoopPingPong(video, 1, 0);
  assert.equal(direction, 1);
  assert.equal(video._idleLoopTape.reverseStartedAt, null);
});
