import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  collapsedVoiceBarIsSpeaking,
  shouldCollapseVoiceMessageBar,
  voiceComposerDockItemsClass,
  voiceMessageBarHasDraftAttachments,
} from './voiceMessageBar.js';

test('a click on the message bar itself does not collapse it', () => {
  const bar = {};
  assert.equal(
    shouldCollapseVoiceMessageBar({
      closest: (selector) =>
        selector.includes('[data-voice-message-bar]') ? bar : null,
    }),
    false
  );
});

test('a click on a control does not collapse the message bar', () => {
  const button = {};
  assert.equal(
    shouldCollapseVoiceMessageBar({
      closest: (selector) =>
        selector.includes('button') ? button : null,
    }),
    false
  );
});

test('a click on the header or caption dock does not collapse the message bar', () => {
  const chrome = {};
  assert.equal(
    shouldCollapseVoiceMessageBar({
      closest: (selector) =>
        selector.includes('[data-voice-stage-header]') ? chrome : null,
    }),
    false
  );
  assert.equal(
    shouldCollapseVoiceMessageBar({
      closest: (selector) =>
        selector.includes('[data-voice-caption-dock]') ? chrome : null,
    }),
    false
  );
});

test('a click on the mute indicators does not collapse the message bar', () => {
  const muteBar = {};
  assert.equal(
    shouldCollapseVoiceMessageBar({
      closest: (selector) =>
        selector.includes('[data-voice-mute-bar]') ? muteBar : null,
    }),
    false
  );
});

test('a click on empty stage collapses the message bar', () => {
  assert.equal(
    shouldCollapseVoiceMessageBar({ closest: () => null }),
    true
  );
  assert.equal(shouldCollapseVoiceMessageBar(null), true);
});

test('the folded bar glows while the person is speaking or dictating', () => {
  assert.equal(collapsedVoiceBarIsSpeaking(), false);
  assert.equal(collapsedVoiceBarIsSpeaking({ hearingSpeech: true }), true);
  assert.equal(collapsedVoiceBarIsSpeaking({ dictating: true }), true);
  assert.equal(
    collapsedVoiceBarIsSpeaking({ hearingSpeech: false, dictating: false }),
    false
  );
});

test('the folded handle stretches to the mute pill; the open composer keeps mute at the foot', () => {
  assert.equal(voiceComposerDockItemsClass(true), 'items-stretch');
  assert.equal(voiceComposerDockItemsClass(false), 'items-end');
});

test('a waiting or in-flight attachment keeps the message bar open', () => {
  assert.equal(voiceMessageBarHasDraftAttachments(), false);
  assert.equal(
    voiceMessageBarHasDraftAttachments({ mediaFileCount: 1 }),
    true
  );
  assert.equal(
    voiceMessageBarHasDraftAttachments({ inFlightCount: 1 }),
    true
  );
});
