import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  composeComposerAttachments,
  describeAttachment,
  isImageAttachment,
  mediaEntriesFromFiles,
} from './composerAttachments.js';

test('an image is named from its media type and can be previewed', () => {
  const photo = { name: 'shot.jpg', type: 'image/jpeg' };
  const described = describeAttachment(photo);
  assert.equal(described.label, 'Image');
  assert.equal(isImageAttachment(photo), true);
});

test('audio, video, and documents get a chip instead of a thumbnail', () => {
  assert.equal(
    describeAttachment({ name: 'clip.mp3', type: 'audio/mpeg' }).label,
    'Audio'
  );
  assert.equal(
    describeAttachment({ name: 'clip.mp4', type: 'video/mp4' }).label,
    'Video'
  );
  assert.equal(
    describeAttachment({ name: 'notes.csv', type: 'application/octet-stream' })
      .label,
    'Data'
  );
  assert.equal(
    describeAttachment({ name: 'brief.pdf', type: '' }).label,
    'Document'
  );
  assert.equal(isImageAttachment({ name: 'brief.pdf', type: '' }), false);
});

test('composed files sit in front of files already on their way', () => {
  const waiting = [{ name: 'new.png' }];
  const sending = [{ name: 'sent.png' }];
  assert.deepEqual(composeComposerAttachments(waiting, sending), [
    waiting[0],
    sending[0],
  ]);
  assert.deepEqual(composeComposerAttachments(undefined, undefined), []);
});

test('sent bubbles point at an object URL for each attached file', () => {
  const photo = { name: 'shot.png', type: 'image/png' };
  const entries = mediaEntriesFromFiles([photo], (file) => `blob:${file.name}`);
  assert.deepEqual(entries, [
    {
      filename: 'shot.png',
      content_type: 'image/png',
      url: 'blob:shot.png',
    },
  ]);
});
