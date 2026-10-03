import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyRememberedAvatarResponseMetrics,
  attachResponseTimeMs,
  fingerprintMessageContent,
  formatMessageCostBreakdown,
  formatMessageMetrics,
  formatTextInferenceModel,
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

test('the text inference model is read from response_metadata', () => {
  assert.equal(
    formatTextInferenceModel({
      response_metadata: {
        text_model: 'meta/llama-3.2-90b-vision-instruct',
        text_model_provider: 'NVIDIA',
      },
    }),
    'meta/llama-3.2-90b-vision-instruct · NVIDIA'
  );
  assert.equal(
    formatTextInferenceModel({
      text_model: 'gpt-5.6-luna',
      text_model_provider: 'OPEN_AI',
      text_model_credit_fallback: true,
    }),
    'gpt-5.6-luna · OPEN_AI (NVIDIA NIM fallback)'
  );
  assert.equal(formatTextInferenceModel({ content: 'Hey.' }), null);
});

test('fingerprint ignores surrounding whitespace', () => {
  assert.equal(
    fingerprintMessageContent('  Hey.  \n'),
    fingerprintMessageContent('Hey.')
  );
});

const TURN_COST_MESSAGE = {
  role: 'assistant',
  total_response_time_ms: 4200,
  usage: { total_tokens: 40120, cost_usd: 0.004 },
  response_metadata: {
    total_cost: 0.004,
    token_usage: { total_tokens: 40120 },
    turn_cost: {
      total_cost_usd: 0.0114,
      total_tokens: 58432,
      reply: { cost_usd: 0.004 },
      image_descriptions: { count: 3, cost_usd: 0.0075 },
      ambient_triage: { count: 1, cost_usd: 0.0019 },
      items: [],
    },
  },
};

test('the metrics line shows the turn total, image descriptions and triage included', () => {
  assert.equal(formatMessageMetrics(TURN_COST_MESSAGE), '4.2s • 58k tokens • $0.011');
});

test('a reply without a turn_cost record still shows the reply cost', () => {
  const { turn_cost: _turnCost, ...replyOnlyMetadata } =
    TURN_COST_MESSAGE.response_metadata;
  assert.equal(
    formatMessageMetrics({ ...TURN_COST_MESSAGE, response_metadata: replyOnlyMetadata }),
    '4.2s • 40k tokens • $0.0040'
  );
});

test('the cost breakdown names the reply, the image descriptions and the triage calls', () => {
  assert.equal(
    formatMessageCostBreakdown(TURN_COST_MESSAGE),
    'reply $0.0040 · 3 image descriptions $0.0075 · 1 triage call $0.0019'
  );
  assert.equal(formatMessageCostBreakdown({ response_metadata: {} }), null);
});
