import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  emotionMediaGenerateLabel,
  emotionMediaGenerationConfirmation,
  emotionMediaStatusView,
  normalizeGenerationBlock,
  portraitUploadGenerationView,
} from './emotionMediaStatusView.js';

test('every flag is a boolean, so JSX never paints a stray 0', () => {
  const view = emotionMediaStatusView({
    complete: true,
    missing: [],
    lastGeneration: { state: 'completed', failures: [] },
    emotions: {
      joy: { idleLoop: 'https://example/joy.mp4' },
    },
  });

  assert.strictEqual(view.showFailure, false);
  assert.strictEqual(view.withheld, false);
  for (const flag of [view.showFailure, view.withheld, view.isComplete]) {
    assert.equal(typeof flag, 'boolean');
  }
});

test('a run that left assets missing shows why, and a withheld run offers to generate anyway', () => {
  const withheld = emotionMediaStatusView({
    complete: false,
    missing: ['anger:still'],
    lastGeneration: {
      withheld: true,
      failures: [{ emotion: 'anger', error_code: 'moderation_predicted' }],
    },
  });
  assert.strictEqual(withheld.showFailure, true);
  assert.strictEqual(withheld.withheld, true);

  const transientMiss = emotionMediaStatusView({
    complete: false,
    missing: ['anger:idle_loop'],
    lastGeneration: {
      failures: [{ emotion: 'anger', error_code: 'vendor_error' }],
    },
  });
  assert.strictEqual(transientMiss.showFailure, true);
  assert.strictEqual(transientMiss.withheld, false);
});

test('an avatar with no loops yet is offered the video create control', () => {
  const view = emotionMediaStatusView({
    complete: false,
    missing: [],
    lastGeneration: null,
    emotions: {},
  });

  assert.strictEqual(view.showFailure, false);
  assert.strictEqual(view.onlyMissing, true);
  assert.strictEqual(view.loopsComplete, false);
  assert.strictEqual(view.needsStills, true);
  assert.equal(view.kind, 'stills_and_videos');
  assert.equal(emotionMediaGenerateLabel(view), 'Create generative reference videos');
});

test('the label says what the press will do', () => {
  assert.equal(
    emotionMediaGenerateLabel({ isComplete: true, missingLoops: 0 }),
    'Regenerate generative reference videos'
  );
  assert.equal(
    emotionMediaGenerateLabel({
      isComplete: false,
      missingLoops: 3,
      missingAssets: 3,
    }),
    'Create the missing generative reference videos'
  );
  assert.equal(
    emotionMediaGenerateLabel({
      isComplete: false,
      missingLoops: 7,
      missingAssets: 7,
    }),
    'Create generative reference videos'
  );
});

test('replacing every video says so, and prices only the loops', () => {
  const view = emotionMediaStatusView({
    complete: true,
    missing: [],
    lastGeneration: { failures: [] },
    emotions: {
      joy: {
        still: 'https://example/joy.jpg',
        idleLoop: 'https://example/joy.mp4',
      },
    },
  });
  const confirmation = emotionMediaGenerationConfirmation(view, {
    costFullRebuild: {
      stills: 6,
      idleLoops: 7,
      imageCostUsd: 0.04,
      videoCostPerSecondUsd: 0.08,
      idleLoopSeconds: 6,
      stillsUsd: 0.24,
      idleLoopsUsd: 3.36,
      totalUsd: 3.6,
    },
    costMissingOnly: { totalUsd: 0 },
  });

  assert.strictEqual(confirmation.isReplacement, true);
  assert.equal(confirmation.title, 'Replace every generative reference video?');
  assert.match(confirmation.description, /current clips are deleted/);
  assert.equal(
    confirmation.costSummary,
    'Expected cost: about $3.36 at the vendor.'
  );
  assert.deepEqual(confirmation.costBreakdown, [
    '7 videos × 6s × $0.08 per second = $3.36',
    'A clip the vendor refuses on content grounds is still charged.',
  ]);
  assert.equal(confirmation.confirmLabel, 'Replace for about $3.36');
});

test('a top-up keeps what exists and prices only what is missing', () => {
  const view = emotionMediaStatusView({
    complete: false,
    missing: ['anger:idle_loop'],
    lastGeneration: { failures: [{ emotion: 'anger' }] },
    emotions: {
      anger: { still: 'https://example/anger.jpg' },
    },
  });
  const confirmation = emotionMediaGenerationConfirmation(view, {
    costFullRebuild: { totalUsd: 3.6 },
    costMissingOnly: {
      stills: 0,
      idleLoops: 1,
      imageCostUsd: 0.04,
      videoCostPerSecondUsd: 0.08,
      idleLoopSeconds: 6,
      stillsUsd: 0,
      idleLoopsUsd: 0.48,
      totalUsd: 0.48,
    },
  });

  assert.strictEqual(confirmation.isReplacement, false);
  assert.match(confirmation.description, /only the 1 missing video\./);
  assert.equal(confirmation.confirmLabel, 'Create for about $0.48');
});

test('without an estimate the confirmation states no numbers', () => {
  const view = emotionMediaStatusView({
    complete: true,
    missing: [],
    emotions: {
      joy: {
        still: 'https://example/joy.jpg',
        idleLoop: 'https://example/joy.mp4',
      },
    },
  });
  const confirmation = emotionMediaGenerationConfirmation(view, {});

  assert.deepEqual(confirmation.costBreakdown, []);
  assert.equal(
    confirmation.costSummary,
    'The cost of this run could not be estimated.'
  );
  assert.equal(confirmation.confirmLabel, 'Replace them');
});

test('the first video build includes stills when none exist', () => {
  const view = emotionMediaStatusView({
    complete: false,
    missing: [],
    emotions: {},
  });
  const confirmation = emotionMediaGenerationConfirmation(view, {
    costMissingOnly: {
      stills: 6,
      idleLoops: 7,
      imageCostUsd: 0.04,
      videoCostPerSecondUsd: 0.08,
      idleLoopSeconds: 6,
      stillsUsd: 0.24,
      idleLoopsUsd: 3.36,
      totalUsd: 3.6,
    },
  });

  assert.equal(view.kind, 'stills_and_videos');
  assert.equal(confirmation.title, 'Create the generative reference videos?');
  assert.equal(
    confirmation.description,
    'This generates 6 emotion portraits and 7 idle videos from the reference image.'
  );
  assert.equal(confirmation.confirmLabel, 'Create for about $3.60');
});

test('a new portrait stores the photo and does not queue stills', () => {
  const empty = portraitUploadGenerationView({
    complete: false,
    missing: [],
    emotions: {},
  });
  assert.strictEqual(empty.generatesStills, false);
  assert.strictEqual(empty.onlyMissing, false);
  assert.equal(empty.missingAssets, 0);

  const replacing = portraitUploadGenerationView({
    complete: true,
    missing: [],
    emotions: { joy: { still: 'https://example/joy.jpg' } },
  });
  assert.strictEqual(replacing.generatesStills, false);
});

test('the generation block is read whichever case the API answers in', () => {
  const fromTheApi = normalizeGenerationBlock({
    tier: 'pro',
    required_tier: 'premium',
    tier_allows: false,
    configured: true,
    allowed: false,
    cost_full_rebuild: {
      stills: 6,
      idle_loops: 7,
      image_cost_usd: 0.04,
      video_cost_per_second_usd: 0.08,
      idle_loop_seconds: 6,
      stills_usd: 0.24,
      idle_loops_usd: 3.36,
      total_usd: 3.6,
    },
    cost_missing_only: null,
  });

  assert.equal(fromTheApi.requiredTier, 'premium');
  assert.equal(fromTheApi.tierAllows, false);
  assert.equal(fromTheApi.allowed, false);
  assert.equal(fromTheApi.costFullRebuild.totalUsd, 3.6);
  assert.equal(fromTheApi.costFullRebuild.idleLoops, 7);
  assert.equal(fromTheApi.costFullRebuild.idleLoopSeconds, 6);
  assert.equal(fromTheApi.costMissingOnly, null);

  const alreadyCamelCase = normalizeGenerationBlock({
    requiredTier: 'premium',
    tierAllows: true,
    allowed: true,
    configured: true,
    costFullRebuild: { totalUsd: 3.6 },
  });
  assert.equal(alreadyCamelCase.requiredTier, 'premium');
  assert.equal(alreadyCamelCase.costFullRebuild.totalUsd, 3.6);

  assert.equal(normalizeGenerationBlock(null), null);
  assert.equal(normalizeGenerationBlock(undefined), null);
});

test('the confirmation prices a video run from the API block', () => {
  const generation = normalizeGenerationBlock({
    cost_full_rebuild: {
      stills: 6,
      idle_loops: 7,
      image_cost_usd: 0.04,
      video_cost_per_second_usd: 0.08,
      idle_loop_seconds: 6,
      stills_usd: 0.24,
      idle_loops_usd: 3.36,
      total_usd: 3.6,
    },
  });
  const confirmation = emotionMediaGenerationConfirmation(
    {
      isComplete: true,
      missingAssets: 0,
      onlyMissing: false,
      kind: 'videos',
    },
    generation
  );
  assert.match(confirmation.costSummary, /3\.36/);
  assert.equal(confirmation.costBreakdown.length, 2);
  assert.match(confirmation.costBreakdown[0], /7 videos × 6s/);
});
