import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasSpeakerScript, speakerLinesOf } from './speakerScript.js';

test('speakerLinesOf merges consecutive lines of one speaker and drops empty text', () => {
  const lines = speakerLinesOf([
    { speaker: 'Evan', text: 'Hello.', is_owner: true },
    { speaker: 'Evan', text: 'How are you?', is_owner: true },
    { speaker: 'Speaker 2', text: '   ' },
    { speaker: 'Speaker 2', text: 'Fine, thanks.' },
    { speaker: 'Evan', text: 'Good.', is_owner: true },
  ]);
  assert.deepEqual(lines, [
    { speaker: 'Evan', text: 'Hello. How are you?', isOwner: true },
    { speaker: 'Speaker 2', text: 'Fine, thanks.', isOwner: false },
    { speaker: 'Evan', text: 'Good.', isOwner: true },
  ]);
});

test('hasSpeakerScript needs at least one segment', () => {
  assert.equal(hasSpeakerScript({ speakers: { segments: [{ speaker: 'A', text: 'x' }] } }), true);
  assert.equal(hasSpeakerScript({ speakers: { segments: [] } }), false);
  assert.equal(hasSpeakerScript({ content: 'typed' }), false);
  assert.equal(hasSpeakerScript(null), false);
});
