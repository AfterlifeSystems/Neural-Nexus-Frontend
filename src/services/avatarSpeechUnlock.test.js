import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import {
  isSpeechPlayBlocked,
  isUnlockedSpeechElement,
  playOnUnlockedSpeechElement,
  primeAvatarSpeechPlayback,
  primedSpeechElement,
  resetAvatarSpeechUnlockForTests,
} from './avatarSpeechUnlock.js';

class FakeAudio {
  constructor() {
    this.src = '';
    this.muted = false;
    this.volume = 1;
    this.paused = true;
    this.playCalls = 0;
  }

  play() {
    this.playCalls += 1;
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
  }
}

afterEach(() => {
  resetAvatarSpeechUnlockForTests();
  delete globalThis.Audio;
});

test('NotAllowedError is the mobile autoplay gate', () => {
  assert.equal(isSpeechPlayBlocked({ name: 'NotAllowedError' }), true);
  assert.equal(isSpeechPlayBlocked({ name: 'NotSupportedError' }), false);
  assert.equal(isSpeechPlayBlocked(null), false);
});

test('a tap primes one element that later utterances reuse', () => {
  const created = [];
  globalThis.Audio = class extends FakeAudio {
    constructor() {
      super();
      created.push(this);
    }
  };

  assert.equal(primeAvatarSpeechPlayback(), true);
  assert.equal(created.length, 1);
  assert.equal(created[0].playCalls, 1);
  assert.equal(created[0].muted, true);
  assert.ok(created[0].src.startsWith('data:audio/wav'));
  assert.equal(primedSpeechElement(), created[0]);

  const spoken = playOnUnlockedSpeechElement('blob:reply');
  assert.equal(spoken, created[0]);
  assert.equal(created.length, 1);
  assert.equal(spoken.src, 'blob:reply');
  assert.equal(spoken.muted, false);
  assert.equal(spoken.volume, 1);
  assert.equal(isUnlockedSpeechElement(spoken), true);
});

test('priming again does not replace a reply that is already playing', () => {
  globalThis.Audio = FakeAudio;
  primeAvatarSpeechPlayback();
  const spoken = playOnUnlockedSpeechElement('blob:reply');
  spoken.paused = false;
  spoken.playCalls = 0;

  assert.equal(primeAvatarSpeechPlayback(), true);
  assert.equal(spoken.src, 'blob:reply');
  assert.equal(spoken.playCalls, 0);
});
