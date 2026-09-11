import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import {
  announceSceneNarration,
  canSpeakLocally,
  primeLocalVoice,
  speakLocally,
  stopNarrationSpeech,
} from './sceneNarrationSpeech.js';

/**
 * A speech synthesis that behaves itself: every utterance ends.
 */
function speakingBrowser({ endsOnItsOwn = true } = {}) {
  const spoken = [];
  let cancelled = 0;
  globalThis.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text;
      this.rate = 1;
      this.listeners = {};
    }
    addEventListener(name, handler) {
      this.listeners[name] = handler;
    }
  };
  globalThis.speechSynthesis = {
    speak(utterance) {
      spoken.push(utterance);
      if (endsOnItsOwn) utterance.listeners.end?.();
    },
    cancel() {
      cancelled += 1;
    },
  };
  return {
    spoken,
    cancelCount: () => cancelled,
  };
}

afterEach(() => {
  delete globalThis.speechSynthesis;
  delete globalThis.SpeechSynthesisUtterance;
});

test('a browser with speech synthesis can speak, one without cannot', () => {
  assert.equal(canSpeakLocally(), false);
  speakingBrowser();
  assert.equal(canSpeakLocally(), true);
});

test('a line is spoken with the browser voice', async () => {
  const browser = speakingBrowser();
  const spoken = await speakLocally('A door is ahead of you.');
  assert.equal(spoken, true);
  assert.equal(browser.spoken.length, 1);
  assert.equal(browser.spoken[0].text, 'A door is ahead of you.');
});

test('an empty line is not spoken at all', async () => {
  const browser = speakingBrowser();
  assert.equal(await speakLocally('   '), false);
  assert.equal(browser.spoken.length, 0);
});

test('a browser that cannot speak refuses rather than throwing', async () => {
  assert.equal(await speakLocally('anything'), false);
});

test('an utterance the browser never finishes still settles', async () => {
  // Some browsers drop an utterance queued while the tab is busy and fire no
  // event at all. The narration loop awaits this call, so a promise that never
  // settled would wedge the mode: the person would hear one description and
  // then nothing, for ever.
  speakingBrowser({ endsOnItsOwn: false });
  const settled = await Promise.race([
    speakLocally('x'),
    new Promise((resolve) => setTimeout(() => resolve('never'), 4000)),
  ]);
  assert.equal(settled, true);
});

/** What was actually said, ignoring the silent utterance that unlocks the voice. */
function saidAloud(browser) {
  return browser.spoken.filter((utterance) => utterance.text.trim() !== '');
}

test('switching on announces the mode and names the avatar', async () => {
  const browser = speakingBrowser();
  await announceSceneNarration(true, { avatarName: 'Ada' });
  const said = saidAloud(browser);
  assert.equal(said.length, 1);
  assert.match(said[0].text, /Describing your surroundings with Ada/);
  assert.match(said[0].text, /Point your camera/);
});

test('switching on without an avatar still announces', async () => {
  const browser = speakingBrowser();
  await announceSceneNarration(true);
  assert.match(saidAloud(browser)[0].text, /^Describing your surroundings\./);
});

test('the browser voice is unlocked during the press that switches it on', () => {
  // Several browsers refuse to speak until a gesture has happened. The silent
  // utterance rides inside the press, so the fallback voice still works later,
  // when the descriptions arrive with no gesture behind them.
  const browser = speakingBrowser();
  primeLocalVoice();
  assert.equal(browser.spoken.length, 1);
  assert.equal(browser.spoken[0].text.trim(), '');
  assert.equal(browser.spoken[0].volume, 0);
});

test('an announcement for an avatar still reaches the person when its voice cannot', async () => {
  // Named avatar, but no API to fetch its voice from here: the person must
  // still hear the confirmation, because a press they cannot see the result of
  // is indistinguishable from one that did not register.
  const browser = speakingBrowser();
  const how = await announceSceneNarration(true, {
    avatarName: 'Ada',
    assistantId: 'avatar-1',
  });
  assert.equal(how, 'browser');
  assert.match(saidAloud(browser).at(-1).text, /Describing your surroundings with Ada/);
});

test('switching off silences what is being said and says so', async () => {
  const browser = speakingBrowser();
  await announceSceneNarration(false);
  const said = saidAloud(browser);
  // Stopping must cut off a description already being read out: "stop" from
  // somebody who cannot see the screen means stop now, not after this sentence.
  assert.ok(browser.cancelCount() >= 1);
  assert.match(said.at(-1).text, /stopped/i);
});

test('stopping is safe with nothing playing and no browser voice', () => {
  assert.doesNotThrow(() => stopNarrationSpeech());
});
