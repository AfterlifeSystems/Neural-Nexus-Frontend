import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  emotionMediaGenerateLabel,
  emotionMediaGenerationConfirmation,
  emotionMediaStatusView,
} from './emotionMediaStatusView.js';

test('every flag is a boolean, so JSX never paints a stray 0', () => {
  // A finished run with no failures: counts are zero, and the card must show
  // nothing rather than the number zero.
  const view = emotionMediaStatusView({
    complete: true,
    missing: [],
    lastGeneration: { state: 'completed', failures: [] },
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

test('an avatar with no run yet is offered the whole set', () => {
  const view = emotionMediaStatusView({
    complete: false,
    missing: [],
    lastGeneration: null,
  });

  assert.strictEqual(view.showFailure, false);
  assert.strictEqual(view.onlyMissing, true);
  assert.equal(emotionMediaGenerateLabel(view), 'Generate images & videos');
});

test('the label says what the press will do', () => {
  assert.equal(
    emotionMediaGenerateLabel({ isComplete: true, missingAssets: 0 }),
    'Regenerate images & videos'
  );
  assert.equal(
    emotionMediaGenerateLabel({ isComplete: false, missingAssets: 3 }),
    'Generate the missing images & videos'
  );
  assert.equal(
    emotionMediaGenerateLabel({ isComplete: false, missingAssets: 14 }),
    'Generate images & videos'
  );
});

test('replacing every asset says so, and prices the whole set', () => {
  const view = emotionMediaStatusView({
    complete: true,
    missing: [],
    lastGeneration: { failures: [] },
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
  assert.equal(confirmation.title, 'Replace every emotion image and video?');
  assert.match(confirmation.description, /current videos are deleted/);
  assert.equal(
    confirmation.costSummary,
    'Expected cost: about $3.60 at the vendor.'
  );
  assert.deepEqual(confirmation.costBreakdown, [
    '6 images × $0.04 = $0.24',
    '7 videos × 6s × $0.08 per second = $3.36',
    'A clip the vendor refuses on content grounds is still charged.',
  ]);
  assert.equal(confirmation.confirmLabel, 'Replace for about $3.60');
});

test('a top-up keeps what exists and prices only what is missing', () => {
  const view = emotionMediaStatusView({
    complete: false,
    missing: ['anger:idle_loop'],
    lastGeneration: { failures: [{ emotion: 'anger' }] },
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
  assert.match(confirmation.description, /only the 1 missing asset\./);
  assert.equal(confirmation.confirmLabel, 'Generate for about $0.48');
});

test('without an estimate the confirmation states no numbers', () => {
  const view = emotionMediaStatusView({ complete: true, missing: [] });
  const confirmation = emotionMediaGenerationConfirmation(view, {});

  assert.deepEqual(confirmation.costBreakdown, []);
  assert.equal(
    confirmation.costSummary,
    'The cost of this run could not be estimated.'
  );
  assert.equal(confirmation.confirmLabel, 'Replace them');
});

test('the first build says what it makes, not what it keeps', () => {
  const view = emotionMediaStatusView({ complete: false, missing: [] });
  const confirmation = emotionMediaGenerationConfirmation(
    { ...view, missingAssets: 14 },
    {
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
    }
  );

  assert.equal(confirmation.title, 'Generate the emotion images and videos?');
  assert.equal(
    confirmation.description,
    'This generates 6 emotion images and 7 idle videos from the reference image.'
  );
  assert.equal(confirmation.confirmLabel, 'Generate for about $3.60');
});
