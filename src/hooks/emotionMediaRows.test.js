import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emotionMediaRows, titleCaseEmotion } from './emotionMediaRows.js';

test('titleCaseEmotion capitalises the base emotion', () => {
  assert.equal(titleCaseEmotion('joy'), 'Joy');
  assert.equal(titleCaseEmotion(''), '');
});

test('emotionMediaRows lists each still and loop as its own row', () => {
  const rows = emotionMediaRows({
    emotions: {
      neutral: {
        still: 'https://api/n.jpg',
        stillId: 'n-still',
        stillMimeType: 'image/jpeg',
        stillCreatedAt: '2026-09-01T00:00:00+00:00',
        idleLoop: 'https://api/n.mp4',
        idleLoopId: 'n-loop',
        idleLoopMimeType: 'video/mp4',
        idleLoopDurationSeconds: 6,
      },
      joy: {
        still: 'https://api/j.jpg',
        stillId: 'j-still',
        idleLoop: null,
        idleLoopId: null,
      },
    },
  });
  assert.equal(rows.length, 3);
  assert.equal(rows[0].label, 'Neutral portrait (reference image)');
  assert.equal(rows[0].bucket, 'emotion_portrait');
  assert.equal(rows[0].isReferenceStill, true);
  assert.equal(rows[0].mimeType, 'image/jpeg');
  assert.equal(rows[0].createdAt, '2026-09-01T00:00:00+00:00');
  assert.equal(rows[1].label, 'Neutral idle loop');
  assert.equal(rows[1].bucket, 'emotion_loop');
  assert.equal(rows[1].posterUrl, 'https://api/n.jpg');
  assert.equal(rows[1].durationSeconds, 6);
  assert.equal(rows[2].label, 'Joy portrait');
  assert.equal(rows[2].assetId, 'j-still');
  assert.equal(rows[2].isReferenceStill, false);
  assert.ok(rows.every((row) => row.source === 'emotion'));
});

test('emotionMediaRows omits missing assets and an empty manifest', () => {
  assert.deepEqual(emotionMediaRows(null), []);
  assert.deepEqual(emotionMediaRows({ emotions: {} }), []);
});
