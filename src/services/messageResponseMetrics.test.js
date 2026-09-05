import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyRememberedAvatarResponseMetrics,
  attachResponseTimeMs,
  fingerprintMessageContent,
  formatMessageMetrics,
  rememberAvatarResponseMetrics,
  resolveMessageResponseTimeMs,
} from './messageResponseMetrics.js';

test('duration is read from the live envelope field', () => {
  assert.equal(resolveMessageResponseTimeMs({ total_response_time_ms: 12286 }), 12286);
  assert.equal(
    formatMessageMetrics({
      total_response_time_ms: 12286,
      usage: { total_tokens: 20965 },
      response_metadata: { total_cost: 0.0012 },
    }),
    '12.3s • 21k tokens • $0.0012'
  );
});

test('duration is read from stored response_metadata when the envelope field is gone', () => {
  const stored = {
    type: 'ai',
    content: 'Hey.',
    response_metadata: {
      token_usage: { total_tokens: 8400 },
      total_cost: 0.0012,
      total_response_time_ms: 4600,
    },
  };
  assert.equal(resolveMessageResponseTimeMs(stored), 4600);
  assert.equal(formatMessageMetrics(stored), '4.6s • 8.4k tokens • $0.0012');
});

test('a stored message with only token_usage is missing time until it is remembered', () => {
  const memory = {};
  globalThis.localStorage = {
    getItem: (key) => memory[key] ?? null,
    setItem: (key, value) => {
      memory[key] = value;
    },
  };

  const stored = {
    type: 'ai',
    content: 'Test received.',
    response_metadata: {
      token_usage: { total_tokens: 8400 },
      total_cost: 0.0012,
    },
  };
  assert.equal(resolveMessageResponseTimeMs(stored), null);
  assert.equal(formatMessageMetrics(stored), '8.4k tokens • $0.0012');

  rememberAvatarResponseMetrics('thread-1', {
    content: 'Test received.',
    total_response_time_ms: 4600,
    timestamp: '2026-09-05T01:11:00.000Z',
    request_id: 'req-1',
  });
  const restored = applyRememberedAvatarResponseMetrics('thread-1', [stored]);
  assert.equal(restored[0].total_response_time_ms, 4600);
  assert.equal(restored[0].timestamp, '2026-09-05T01:11:00.000Z');
  assert.equal(formatMessageMetrics(restored[0]), '4.6s • 8.4k tokens • $0.0012');
});

test('identical replies consume remembered durations in order', () => {
  const memory = {};
  globalThis.localStorage = {
    getItem: (key) => memory[key] ?? null,
    setItem: (key, value) => {
      memory[key] = value;
    },
  };

  rememberAvatarResponseMetrics('thread-2', {
    content: 'Yes.',
    total_response_time_ms: 1000,
  });
  rememberAvatarResponseMetrics('thread-2', {
    content: 'Yes.',
    total_response_time_ms: 2000,
  });
  const restored = applyRememberedAvatarResponseMetrics('thread-2', [
    { type: 'ai', content: 'Yes.' },
    { type: 'human', content: 'again' },
    { type: 'ai', content: 'Yes.' },
  ]);
  assert.equal(restored[0].total_response_time_ms, 1000);
  assert.equal(restored[2].total_response_time_ms, 2000);
});

test('attachResponseTimeMs writes the fields the metrics line already reads', () => {
  const attached = attachResponseTimeMs(
    {
      usage: { total_tokens: 12 },
      response_metadata: { token_usage: { total_tokens: 12 } },
    },
    1500
  );
  assert.equal(attached.total_response_time_ms, 1500);
  assert.equal(attached.usage.latency_ms, 1500);
  assert.equal(attached.response_metadata.total_response_time_ms, 1500);
  assert.equal(formatMessageMetrics(attached), '1.5s • 12 tokens');
});

test('fingerprint ignores surrounding whitespace', () => {
  assert.equal(
    fingerprintMessageContent('  Hey.  \n'),
    fingerprintMessageContent('Hey.')
  );
});
