import assert from 'node:assert/strict';
import { test } from 'node:test';
import { editableScriptText, hasSpeakerScript, speakerLinesOf } from './speakerScript.js';

test('speakerLinesOf merges consecutive lines of one speaker and drops empty text', () => {
  const lines = speakerLinesOf([
    { speaker: 'Evan', text: 'Hello.', is_owner: true },
    { speaker: 'Evan', text: 'How are you?', is_owner: true },
    { speaker: 'Speaker 2', text: '   ' },
    { speaker: 'Speaker 2', text: 'Fine, thanks.' },
    { speaker: 'Evan', text: 'Good.', is_owner: true },
  ]);
  assert.deepEqual(lines, [
    { speaker: 'Evan', text: 'Hello. How are you?', isOwner: true, isAvatar: false },
    { speaker: 'Speaker 2', text: 'Fine, thanks.', isOwner: false, isAvatar: false },
    { speaker: 'Evan', text: 'Good.', isOwner: true, isAvatar: false },
  ]);
});

test('hasSpeakerScript needs at least one segment', () => {
  assert.equal(hasSpeakerScript({ speakers: { segments: [{ speaker: 'A', text: 'x' }] } }), true);
  assert.equal(hasSpeakerScript({ speakers: { segments: [] } }), false);
  assert.equal(hasSpeakerScript({ content: 'typed' }), false);
  assert.equal(hasSpeakerScript(null), false);
});

test('editableScriptText prefers content, then speaker lines, then blocks', () => {
  assert.equal(editableScriptText({ content: 'typed' }), 'typed');
  assert.equal(
    editableScriptText({
      content: '',
      speakers: {
        segments: [
          { speaker: 'Evan', text: 'Hello.', is_owner: true },
          { speaker: 'Evan', text: 'There.', is_owner: true },
        ],
      },
    }),
    'Hello. There.'
  );
  assert.equal(
    editableScriptText({ content: [{ type: 'text', text: 'block' }] }),
    'block'
  );
});
