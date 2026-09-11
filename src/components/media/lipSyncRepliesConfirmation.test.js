import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeGenerationBlock } from './emotionMediaStatusView.js';
import {
  lipSyncRepliesConfirmation,
  lipSyncRepliesMayEnable,
} from './lipSyncRepliesConfirmation.js';

test('the confirmation prices lip-sync replies from the API block', () => {
  const generation = normalizeGenerationBlock({
    allowed: true,
    tier_allows: true,
    required_tier: 'premium',
    cost_full_rebuild: {
      video_cost_per_second_usd: 0.08,
      idle_loop_seconds: 6,
    },
  });
  const confirmation = lipSyncRepliesConfirmation(generation);

  assert.equal(confirmation.title, 'Enable lip-synced video replies?');
  assert.match(confirmation.description, /Nothing is generated until a reply is spoken/);
  assert.match(confirmation.costSummary, /0\.08/);
  assert.match(confirmation.costBreakdown[0], /0\.48/);
  assert.equal(
    confirmation.confirmLabel,
    'Enable for about $0.08 per second'
  );
  assert.equal(lipSyncRepliesMayEnable(generation), true);
});

test('without an estimate the confirmation states no numbers', () => {
  const confirmation = lipSyncRepliesConfirmation(null);
  assert.equal(
    confirmation.costSummary,
    'The cost of this setting could not be estimated.'
  );
  assert.deepEqual(confirmation.costBreakdown, []);
  assert.equal(confirmation.confirmLabel, 'Enable lip-synced replies');
  assert.equal(lipSyncRepliesMayEnable(null), true);
});

test('a plan below the required tier may not enable lip-sync replies', () => {
  const generation = normalizeGenerationBlock({
    allowed: false,
    tier_allows: false,
    required_tier: 'premium',
    configured: true,
  });
  assert.equal(lipSyncRepliesMayEnable(generation), false);
});
