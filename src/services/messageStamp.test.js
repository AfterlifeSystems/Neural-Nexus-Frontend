import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  formatMessageStamp,
  messageStampDateTime,
  messageStampValueOf,
  parseMessageStampDate,
} from './messageStamp.js';

const NOW = new Date(2026, 8, 13, 23, 0, 0);

test('a live send prefers timestamp over nested created_at', () => {
  assert.equal(
    messageStampValueOf({
      timestamp: '2026-09-13T15:08:00.000Z',
      created_at: '2026-01-01T00:00:00.000Z',
      additional_kwargs: { created_at: '2025-01-01T00:00:00.000Z' },
    }),
    '2026-09-13T15:08:00.000Z'
  );
});

test('a stored turn without timestamp still stamps from created_at', () => {
  assert.equal(
    messageStampValueOf({
      created_at: '2026-09-12T12:00:00.000Z',
    }),
    '2026-09-12T12:00:00.000Z'
  );
  assert.equal(
    messageStampValueOf({
      additional_kwargs: { created_at: '2026-09-11T12:00:00.000Z' },
    }),
    '2026-09-11T12:00:00.000Z'
  );
  assert.equal(
    messageStampValueOf({
      response_metadata: { created_at: '2026-09-10T12:00:00.000Z' },
    }),
    '2026-09-10T12:00:00.000Z'
  );
});

test('a missing or invalid instant is not a stamp', () => {
  assert.equal(messageStampValueOf(null), null);
  assert.equal(parseMessageStampDate('not-a-date'), null);
  assert.equal(formatMessageStamp(null), '');
  assert.equal(formatMessageStamp('nope'), '');
  assert.equal(messageStampDateTime('nope'), '');
});

test('this year is month, day, and time', () => {
  const sentAt = new Date(2026, 8, 13, 15, 8);
  assert.equal(
    formatMessageStamp(sentAt, { now: NOW, locale: 'en-US' }),
    'Sep 13, 3:08 PM'
  );
});

test('another year keeps the year so an archive is dated', () => {
  const sentAt = new Date(2025, 8, 13, 15, 8);
  assert.equal(
    formatMessageStamp(sentAt, { now: NOW, locale: 'en-US' }),
    'Sep 13, 2025, 3:08 PM'
  );
});

test('the machine stamp is ISO so a screen reader can read the instant', () => {
  assert.equal(
    messageStampDateTime('2026-09-13T15:08:00.000Z'),
    '2026-09-13T15:08:00.000Z'
  );
});
