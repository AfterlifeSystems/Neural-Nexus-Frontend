import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  meanRgbDistance,
  pingPongMaxFrames,
  reverseFrameAtElapsed,
  reverseFrameIndex,
  stepIdleLoopPingPong,
  tapeIsUsable,
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
    pingPongActive: true,
    pingPongRejected: false,
    reverseStartedAt: null,
    holdingStart: false,
    seekStarted: false,
    scratch: null,
  };
}

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

test('a long tape that is too sparse is not usable', () => {
  const frames = [];
  for (let index = 0; index < 20; index += 1) {
    frames.push({ time: (index / 19) * 2 });
  }
  assert.equal(tapeIsUsable(frames, 2.1), false);
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
  assert.equal(pingPongMaxFrames(4), 96);
  assert.equal(pingPongMaxFrames(20), 96);
});

test('reverse follows recorded media time, not a uniform index', () => {
  const frames = [0, 0.1, 0.2, 0.9, 1].map((time) => ({ time }));
  assert.equal(reverseFrameAtElapsed(frames, 0), 4);
  assert.equal(reverseFrameAtElapsed(frames, 0.15), 3);
  assert.equal(reverseFrameAtElapsed(frames, 1), 0);
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
