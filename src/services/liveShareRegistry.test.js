import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import {
  LOOK_NOW_INTERRUPT_KIND,
  MAXIMUM_LOOKS_PER_TURN,
  captureLiveShareFrames,
  getLiveShareSources,
  liveShareFormValue,
  peekAtLiveDesktop,
  peekThroughLiveCamera,
  peekableShareFormValue,
  getPeekableShareSources,
  publishLiveShares,
  resetLiveShares,
  sourceOfFrameName,
  startLiveScreenShare,
  stopLiveShares,
} from './liveShareRegistry.js';

beforeEach(() => resetLiveShares());

test('nothing shared reports no sources and no form value', () => {
  assert.deepEqual(getLiveShareSources(), []);
  assert.equal(liveShareFormValue(), null);
});

test('the form value is the JSON list the API reads', () => {
  publishLiveShares({ sources: ['webcam', 'screen'] });
  assert.equal(liveShareFormValue(), '["webcam","screen"]');
});

test('published sources are copied, so a later mutation cannot change them', () => {
  const sources = ['webcam'];
  publishLiveShares({ sources });
  sources.push('screen');
  assert.deepEqual(getLiveShareSources(), ['webcam']);
});

test('a capture asks only for sources that are actually live', async () => {
  const asked = [];
  publishLiveShares({
    sources: ['webcam'],
    capture: async (wanted) => {
      asked.push(wanted);
      return [new File([''], 'webcam.jpg')];
    },
  });
  const frames = await captureLiveShareFrames(['webcam', 'screen']);
  assert.deepEqual(asked, [['webcam']]);
  assert.equal(frames.length, 1);
});

test('a capture with no sources named takes everything live', async () => {
  const asked = [];
  publishLiveShares({
    sources: ['webcam', 'screen'],
    capture: async (wanted) => {
      asked.push(wanted);
      return [];
    },
  });
  await captureLiveShareFrames();
  assert.deepEqual(asked, [['webcam', 'screen']]);
});

test('asking to capture a source that is not live captures nothing', async () => {
  let called = false;
  publishLiveShares({
    sources: ['webcam'],
    capture: async () => {
      called = true;
      return [];
    },
  });
  assert.deepEqual(await captureLiveShareFrames(['screen']), []);
  assert.equal(called, false);
});

test('a capture that throws yields no frames rather than failing the turn', async () => {
  publishLiveShares({
    sources: ['webcam'],
    capture: async () => {
      throw new Error('the camera went away');
    },
  });
  assert.deepEqual(await captureLiveShareFrames(['webcam']), []);
});

test('a share that ends stops being reported', () => {
  publishLiveShares({ sources: ['webcam', 'screen'], capture: async () => [] });
  publishLiveShares({ sources: ['webcam'] });
  assert.deepEqual(getLiveShareSources(), ['webcam']);
  assert.equal(liveShareFormValue(), '["webcam"]');
});

test('a frame is named by the source it came from', () => {
  assert.equal(sourceOfFrameName('webcam.jpg'), 'webcam');
  assert.equal(sourceOfFrameName('screen.jpg'), 'screen');
  assert.equal(sourceOfFrameName('something-else.png'), 'image');
  assert.equal(sourceOfFrameName(undefined), 'image');
});

test('the pause kind and the look cap are the values the server and turn agree on', () => {
  assert.equal(LOOK_NOW_INTERRUPT_KIND, 'look_now');
  assert.ok(MAXIMUM_LOOKS_PER_TURN >= 1);
});

// --- What the avatar may do with the camera and a screen share -------------

test('a peek opens the camera through whatever the share provider published', async () => {
  let opened = 0;
  publishLiveShares({
    sources: [],
    peek: async () => {
      opened += 1;
      return new File([''], 'webcam.jpg');
    },
  });
  const frame = await peekThroughLiveCamera();
  assert.equal(opened, 1);
  assert.equal(frame.name, 'webcam.jpg');
});

test('with no camera published a peek yields nothing rather than throwing', async () => {
  assert.equal(await peekThroughLiveCamera(), null);
});

test('a camera that refuses to open yields nothing rather than failing the turn', async () => {
  publishLiveShares({
    sources: [],
    peek: async () => {
      throw new Error('NotAllowedError');
    },
  });
  assert.equal(await peekThroughLiveCamera(), null);
});

test('switching shares off reports what was actually switched off', () => {
  publishLiveShares({
    sources: ['webcam'],
    stop: (sources) => sources.filter((source) => source === 'webcam'),
  });
  assert.deepEqual(stopLiveShares(['webcam', 'screen']), ['webcam']);
});

test('switching off with nothing published changes nothing', () => {
  assert.deepEqual(stopLiveShares(['webcam']), []);
});

test('a share that cannot be switched off does not fail the turn', () => {
  publishLiveShares({
    sources: ['webcam'],
    stop: () => {
      throw new Error('gone');
    },
  });
  assert.deepEqual(stopLiveShares(['webcam']), []);
});

test('the screen picker is opened through the published starter', async () => {
  let opened = 0;
  publishLiveShares({ sources: [], startScreenShare: async () => { opened += 1; } });
  await startLiveScreenShare();
  assert.equal(opened, 1);
});

test('with no starter published asking for the screen is a no-op', async () => {
  await startLiveScreenShare();
});

test('publishing new sources keeps the capabilities already published', async () => {
  publishLiveShares({
    sources: ['webcam'],
    peek: async () => new File([''], 'webcam.jpg'),
    stop: () => ['webcam'],
  });
  publishLiveShares({ sources: [] });
  assert.notEqual(await peekThroughLiveCamera(), null);
});

// --- What can be looked at once, which is not what is being watched -------
//
// A screen the person is running in PEEK mode is reported here rather than as
// a live share: the capture is running, the person chose in their browser what
// it covers, and nothing reads it until the avatar asks. The camera gets here
// by a different route — a standing origin permission plus a per-avatar
// setting the caller supplies. Neither is ever watched on a timer.

test('a screen being peeked at is reported apart from one being shared', () => {
  resetLiveShares();
  publishLiveShares({ sources: ['webcam'], peekableSources: ['screen'] });
  assert.deepEqual(getLiveShareSources(), ['webcam']);
  assert.deepEqual(getPeekableShareSources(), ['screen']);
  assert.equal(peekableShareFormValue(), '["screen"]');
});

test('the camera is peekable only for an avatar allowed to open it', () => {
  resetLiveShares();
  publishLiveShares({ sources: [], peekableSources: [] });
  assert.deepEqual(getPeekableShareSources({ cameraAllowed: false }), []);
  assert.deepEqual(getPeekableShareSources({ cameraAllowed: true }), [
    'webcam',
  ]);
});

test('a camera already being shared is not also reported as peekable', () => {
  resetLiveShares();
  publishLiveShares({ sources: ['webcam'], peekableSources: [] });
  assert.deepEqual(getPeekableShareSources({ cameraAllowed: true }), []);
});

test('the form value is always sent, even when nothing can be opened', () => {
  // A browser that reports the field is believed, including when it reports
  // that nothing can be opened; only a client that never sends it at all falls
  // back to the older rule on the server.
  resetLiveShares();
  publishLiveShares({ sources: [], peekableSources: [] });
  assert.equal(peekableShareFormValue(), '[]');
});

test('a screen look is taken through whatever the share provider published', async () => {
  resetLiveShares();
  const frame = new File(['x'], 'screen.jpg', { type: 'image/jpeg' });
  publishLiveShares({
    sources: [],
    peekableSources: ['screen'],
    peekDesktop: async () => frame,
  });
  assert.equal(await peekAtLiveDesktop(), frame);
});

test('with no screen published a look yields nothing rather than throwing', async () => {
  resetLiveShares();
  assert.equal(await peekAtLiveDesktop(), null);
});

test('a screen that cannot be captured does not fail the turn', async () => {
  resetLiveShares();
  publishLiveShares({
    sources: [],
    peekableSources: ['screen'],
    peekDesktop: async () => {
      throw new Error('the capture ended');
    },
  });
  assert.equal(await peekAtLiveDesktop(), null);
});

test('the same screen capture is either watched or peeked at, never both', () => {
  // The two modes are what the sidebar's three states report, and they must
  // never overlap: a screen in `sources` is watched on the interval, a screen
  // in `peekableSources` is looked at once when a question needs it.
  resetLiveShares();
  publishLiveShares({ sources: ['screen'], peekableSources: [] });
  assert.deepEqual(getLiveShareSources(), ['screen']);
  assert.deepEqual(getPeekableShareSources(), []);

  publishLiveShares({ sources: [], peekableSources: ['screen'] });
  assert.deepEqual(getLiveShareSources(), []);
  assert.deepEqual(getPeekableShareSources(), ['screen']);

  publishLiveShares({ sources: [], peekableSources: [] });
  assert.deepEqual(getLiveShareSources(), []);
  assert.deepEqual(getPeekableShareSources(), []);
});
