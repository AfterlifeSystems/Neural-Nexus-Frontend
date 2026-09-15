import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  loopingVideoLayerMayReveal,
  loopingVideoLayerIsShown,
  loopingVideoLayersAfterReveal,
  loopingVideoPosterIsVisible,
  loopingVideoIdleLayerIsShown,
} from './loopingVideoLayer.js';

const uiDirectory = dirname(fileURLToPath(import.meta.url));

test('a painted idle loop may show without waiting for the square still', () => {
  assert.equal(
    loopingVideoLayerMayReveal(
      { poster: 'still.jpg', src: 'idle.mp4' },
      { poster: false, video: false, loop: true }
    ),
    true
  );
  assert.equal(
    loopingVideoPosterIsVisible(
      { poster: 'still.jpg', src: 'idle.mp4' },
      true
    ),
    false
  );
});

test('a generated still may show before the idle loop has decoded', () => {
  assert.equal(
    loopingVideoLayerMayReveal(
      { poster: 'still.jpg', src: 'idle.mp4' },
      { poster: true, video: false }
    ),
    true
  );
});

test('the unpainted loop stays hidden while the still is on stage', () => {
  assert.equal(
    loopingVideoIdleLayerIsShown(true, false, true),
    false
  );
  assert.equal(
    loopingVideoIdleLayerIsShown(true, true, true),
    true
  );
  assert.equal(
    loopingVideoPosterIsVisible(
      { poster: 'still.jpg', src: 'idle.mp4' },
      false
    ),
    true
  );
});

test('a still-and-loop pair waits for the still', () => {
  assert.equal(
    loopingVideoLayerMayReveal(
      { poster: 'still.jpg', src: 'idle.mp4' },
      { poster: false, video: true }
    ),
    false
  );
});

test('a loop with no still waits for the video', () => {
  assert.equal(
    loopingVideoLayerMayReveal({ poster: null, src: 'idle.mp4' }, { video: false }),
    false
  );
  assert.equal(
    loopingVideoLayerMayReveal({ poster: null, src: 'idle.mp4' }, { video: true }),
    true
  );
});

test('an empty layer is not shown', () => {
  assert.equal(loopingVideoLayerMayReveal(null), false);
  assert.equal(loopingVideoLayerMayReveal({}), false);
});

test('the first layer stays on stage until a later layer is revealed', () => {
  assert.equal(loopingVideoLayerIsShown(0, null, 0), true);
  assert.equal(loopingVideoLayerIsShown(1, null, 0), false);
  assert.equal(loopingVideoLayerIsShown(0, 1, 0), false);
  assert.equal(loopingVideoLayerIsShown(1, 1, 0), true);
});

test('the still shows until the idle loop has painted a frame', () => {
  assert.equal(
    loopingVideoPosterIsVisible({ poster: 'still.jpg', src: 'idle.mp4' }, false),
    true
  );
  assert.equal(
    loopingVideoPosterIsVisible({ poster: 'still.jpg', src: 'idle.mp4' }, true),
    false
  );
});

test('a still with no loop stays visible', () => {
  assert.equal(
    loopingVideoPosterIsVisible({ poster: 'still.jpg', src: null }, true),
    true
  );
});

test('LoopingVideo takes the still off once the loop has painted', () => {
  const source = readFileSync(join(uiDirectory, 'LoopingVideo.jsx'), 'utf8');
  assert.match(source, /loopingVideoPosterIsVisible/);
  assert.match(source, /loopingVideoIdleLayerIsShown/);
  assert.doesNotMatch(source, /waitForIdleLoop/);
  assert.match(source, /loopPaintedIds/);
});

test('a reveal drops the outgoing face and keeps a newer decoding layer', () => {
  const outgoing = { id: 1, poster: 'a.jpg' };
  const incoming = { id: 2, poster: 'b.jpg' };
  const decoding = { id: 3, poster: 'c.jpg' };
  assert.deepEqual(
    loopingVideoLayersAfterReveal([outgoing, incoming], incoming.id),
    [incoming]
  );
  assert.deepEqual(
    loopingVideoLayersAfterReveal([outgoing, incoming, decoding], incoming.id),
    [incoming, decoding]
  );
});

test('LoopingVideo paints a mounted 9:16 loop before the square still', () => {
  const source = readFileSync(join(uiDirectory, 'LoopingVideo.jsx'), 'utf8');
  assert.match(source, /findMountedIdleLoopVideo/);
  assert.match(source, /useLayoutEffect/);
  assert.match(source, /paintLoopIfReady/);
  assert.match(source, /mountedLoopReady/);
});

test('LoopingVideo cuts to the incoming face with no opacity dissolve', () => {
  const source = readFileSync(join(uiDirectory, 'LoopingVideo.jsx'), 'utf8');
  assert.match(source, /loopingVideoLayersAfterReveal/);
  assert.doesNotMatch(source, /transition-opacity/);
  assert.doesNotMatch(source, /setCrossfade/);
  assert.doesNotMatch(source, /duration-500/);
});
