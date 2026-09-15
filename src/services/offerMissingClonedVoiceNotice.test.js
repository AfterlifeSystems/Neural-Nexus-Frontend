import assert from 'node:assert/strict';
import { test } from 'node:test';
import { offerMissingClonedVoiceNotice } from './offerMissingClonedVoiceNotice.js';

function captureNotice() {
  const shown = [];
  return {
    shown,
    showNotice(parameters) {
      shown.push(parameters);
    },
  };
}

test('a missing clone is offered once the conversation id is known', async () => {
  const { shown, showNotice } = captureNotice();
  await offerMissingClonedVoiceNotice({
    assistantId: 'ava-1',
    avatarName: 'Maya',
    conversationId: '__new__',
    readAvatarVoice: async () => ({ collected_seconds: 12 }),
    showNotice,
  });
  assert.equal(shown.length, 1);
  assert.equal(shown[0].assistantId, 'ava-1');
  assert.equal(shown[0].conversationId, '__new__');
  assert.equal(shown[0].collectedSeconds, 12);
});

test('a conversation that is still loading is not offered', async () => {
  const { shown, showNotice } = captureNotice();
  await offerMissingClonedVoiceNotice({
    assistantId: 'ava-1',
    conversationId: null,
    readAvatarVoice: async () => ({}),
    showNotice,
  });
  assert.equal(shown.length, 0);
});

test('a cloned voice is not offered', async () => {
  const { shown, showNotice } = captureNotice();
  await offerMissingClonedVoiceNotice({
    assistantId: 'ava-1',
    conversationId: '__new__',
    readAvatarVoice: async () => ({ instant_voice_id: 'ivc_1' }),
    showNotice,
  });
  assert.equal(shown.length, 0);
});

test('a standard voice is still offered as a missing clone', async () => {
  const { shown, showNotice } = captureNotice();
  await offerMissingClonedVoiceNotice({
    assistantId: 'ava-1',
    conversationId: '__new__',
    readAvatarVoice: async () => ({
      active_voice: 'standard',
      standard_voice: { voice_id: 'stock_1' },
    }),
    showNotice,
  });
  assert.equal(shown.length, 1);
});

test('a cancelled read does not show the notice', async () => {
  const { shown, showNotice } = captureNotice();
  await offerMissingClonedVoiceNotice({
    assistantId: 'ava-1',
    conversationId: '__new__',
    isCancelled: () => true,
    readAvatarVoice: async () => ({}),
    showNotice,
  });
  assert.equal(shown.length, 0);
});

test('a status read that fails leaves the conversation quiet', async () => {
  const { shown, showNotice } = captureNotice();
  await offerMissingClonedVoiceNotice({
    assistantId: 'ava-1',
    conversationId: '__new__',
    readAvatarVoice: async () => {
      throw new Error('offline');
    },
    showNotice,
  });
  assert.equal(shown.length, 0);
});
