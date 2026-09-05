import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  findMessageByKey,
  findMessageIndexByKey,
  messageKeyOf,
} from './messageKey.js';

test('a stored id is the row key, even when it is a number', () => {
  assert.equal(messageKeyOf({ id: 'abc-1', timestamp: 't' }), 'abc-1');
  assert.equal(messageKeyOf({ id: 2, timestamp: 't' }), '2');
});

test('a turn with no id keys on its timestamp so Accept can find it', () => {
  const row = { type: 'human', content: 'Hello', timestamp: '2026-09-05T12:00:00Z' };
  assert.equal(messageKeyOf(row), 'temp-2026-09-05T12:00:00Z');
  assert.equal(
    findMessageByKey([row], 'temp-2026-09-05T12:00:00Z'),
    row
  );
});

test('lookup matches a numeric id passed as the bubble string', () => {
  const row = { id: 4, type: 'human', content: 'Hi' };
  assert.equal(findMessageIndexByKey([row], '4'), 0);
  assert.equal(findMessageByKey([row], '4'), row);
});

test('a missing or empty key does not invent a match', () => {
  assert.equal(findMessageByKey([{ id: 'a' }], ''), undefined);
  assert.equal(findMessageIndexByKey([{ id: 'a' }], null), -1);
  assert.equal(messageKeyOf({ content: 'no identity' }), null);
});
