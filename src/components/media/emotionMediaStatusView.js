// src/components/media/emotionMediaStatusView.js
//
// What the emotion-media card under the portrait shows, decided as data.
//
// Every flag here is a real boolean. JSX renders a falsy NUMBER — `0 && <p/>`
// is `0`, not nothing — so a count used directly as a condition paints a
// literal "0" under the portrait; that is exactly what `failureCount` and
// `missingAssets` did before this module existed.

import {
  countEmotionMediaFailures,
  emotionMediaWasWithheld,
} from '../../services/emotionMediaFailures.js';

/**
 * The card's state for one manifest.
 *
 * @param {Object|null} manifest A normalized emotion-media manifest.
 * @returns {{showFailure: boolean, withheld: boolean, isComplete: boolean,
 *   missingAssets: number, onlyMissing: boolean}} showFailure: the newest run
 *   left assets missing and said why. withheld: that run was withheld before
 *   any vendor call, so "generate anyway" is the offer. onlyMissing: a
 *   generation run should build the absent assets rather than the whole set.
 */
export const emotionMediaStatusView = (manifest) => {
  const lastGeneration = manifest?.lastGeneration ?? null;
  const { total: failureCount } = countEmotionMediaFailures(
    lastGeneration?.failures
  );
  const missingAssets = manifest?.missing?.length ?? 0;
  const showFailure = Boolean(lastGeneration) && failureCount > 0 && missingAssets > 0;
  return {
    showFailure,
    withheld: showFailure && Boolean(emotionMediaWasWithheld(lastGeneration)),
    isComplete: Boolean(manifest?.complete),
    missingAssets,
    onlyMissing: !manifest?.complete,
  };
};

/**
 * What a new reference image will do to generated media.
 *
 * Uploading a portrait rebuilds the whole set from that image. If clips
 * already exist this is a replacement; if none exist it is a first build.
 *
 * @param {Object|null} manifest A normalized emotion-media manifest.
 * @param {number} [totalAssets] How many stills and loops a full set holds.
 * @returns {{isComplete: boolean, missingAssets: number, onlyMissing: boolean}}
 */
export const portraitUploadGenerationView = (manifest, totalAssets = 14) => {
  const emotions = manifest?.emotions ?? {};
  const hasExisting = Object.values(emotions).some(
    (entry) => Boolean(entry?.still) || Boolean(entry?.idleLoop)
  );
  if (hasExisting) {
    return { isComplete: true, missingAssets: 0, onlyMissing: false };
  }
  return {
    isComplete: false,
    missingAssets: totalAssets,
    onlyMissing: true,
  };
};

/**
 * The generate button's label for that state.
 *
 * @param {{isComplete: boolean, missingAssets: number}} view From emotionMediaStatusView.
 * @param {number} [totalAssets] How many stills and loops a full set holds.
 * @returns {string} The button label.
 */
export const emotionMediaGenerateLabel = (view, totalAssets = 14) => {
  if (view.isComplete) return 'Regenerate images & videos';
  if (view.missingAssets > 0 && view.missingAssets < totalAssets) {
    return 'Generate the missing images & videos';
  }
  return 'Generate images & videos';
};

/**
 * A US dollar amount, written the way the confirmation shows it.
 *
 * @param {number} amount An amount in US dollars.
 * @returns {string} For example `$3.60`.
 */
export const formatUsd = (amount) =>
  `$${Number(amount ?? 0).toFixed(2)}`;

/**
 * The manifest's `generation` block in the shape this view layer reads.
 *
 * The API answers in snake_case, and every reader here is camelCase. Without
 * this the tier sentence read "the undefined plan" and the confirmation priced
 * a run that spends real money at $0.00 — so the mapping is done once, here,
 * rather than at each of the dozen read sites. A block already in camelCase is
 * passed through, which keeps older callers and the fixtures below working.
 *
 * @param {Object|null|undefined} generation The block as the API sent it.
 * @returns {Object|null} The camelCase block, or null when the caller may not generate.
 */
export const normalizeGenerationBlock = (generation) => {
  if (!generation) return null;

  const normalizeCost = (cost) => {
    if (!cost) return null;
    return {
      stills: cost.stills ?? 0,
      idleLoops: cost.idleLoops ?? cost.idle_loops ?? 0,
      imageCostUsd: cost.imageCostUsd ?? cost.image_cost_usd ?? 0,
      videoCostPerSecondUsd:
        cost.videoCostPerSecondUsd ?? cost.video_cost_per_second_usd ?? 0,
      idleLoopSeconds: cost.idleLoopSeconds ?? cost.idle_loop_seconds ?? 0,
      stillsUsd: cost.stillsUsd ?? cost.stills_usd ?? 0,
      idleLoopsUsd: cost.idleLoopsUsd ?? cost.idle_loops_usd ?? 0,
      totalUsd: cost.totalUsd ?? cost.total_usd ?? 0,
    };
  };

  return {
    tier: generation.tier ?? null,
    requiredTier: generation.requiredTier ?? generation.required_tier ?? null,
    tierAllows: generation.tierAllows ?? generation.tier_allows ?? false,
    configured: generation.configured ?? false,
    allowed: generation.allowed ?? false,
    costFullRebuild: normalizeCost(
      generation.costFullRebuild ?? generation.cost_full_rebuild
    ),
    costMissingOnly: normalizeCost(
      generation.costMissingOnly ?? generation.cost_missing_only
    ),
  };
};

/**
 * What the confirmation asks before a generation run spends anything.
 *
 * A full rebuild REPLACES every generated still and idle loop the avatar has,
 * so the wording says so plainly and prices the whole set. A top-up builds
 * only what is absent and keeps what exists. Without an estimate from the
 * server (an older API), the cost lines are omitted rather than invented.
 *
 * @param {{isComplete: boolean, missingAssets: number, onlyMissing: boolean}} view
 *   From emotionMediaStatusView.
 * @param {Object|null} generation The manifest's `generation` block.
 * @returns {{title: string, description: string, costSummary: string,
 *   costBreakdown: string[], confirmLabel: string, isReplacement: boolean}}
 */
export const emotionMediaGenerationConfirmation = (
  view,
  generation,
  totalAssets = 14
) => {
  const isReplacement = !view.onlyMissing;
  // Nothing generated yet: the run builds the whole set, but replaces nothing.
  const isFirstBuild = !isReplacement && view.missingAssets >= totalAssets;
  const cost = isReplacement
    ? (generation?.costFullRebuild ?? null)
    : (generation?.costMissingOnly ?? null);
  const stills = cost?.stills ?? 0;
  const idleLoops = cost?.idleLoops ?? 0;

  const description = isReplacement
    ? 'This replaces every emotion image and video this avatar already has. The current videos are deleted and rendered again from the reference image — a regeneration never keeps the old clips.'
    : isFirstBuild
      ? `This generates ${stills || 'the'} emotion image${stills === 1 ? '' : 's'} and ${idleLoops || ''} idle video${idleLoops === 1 ? '' : 's'} from the reference image.`
          .replace(/\s+/g, ' ')
          .trim()
      : `This generates only the ${view.missingAssets} missing asset${
          view.missingAssets === 1 ? '' : 's'
        }. Everything already generated is kept.`;

  const costBreakdown = cost
    ? [
        `${stills} image${stills === 1 ? '' : 's'} × ${formatUsd(cost.imageCostUsd)} = ${formatUsd(cost.stillsUsd)}`,
        `${idleLoops} video${idleLoops === 1 ? '' : 's'} × ${cost.idleLoopSeconds}s × ${formatUsd(cost.videoCostPerSecondUsd)} per second = ${formatUsd(cost.idleLoopsUsd)}`,
        'A clip the vendor refuses on content grounds is still charged.',
      ]
    : [];

  return {
    title: isReplacement
      ? 'Replace every emotion image and video?'
      : isFirstBuild
        ? 'Generate the emotion images and videos?'
        : 'Generate the missing images and videos?',
    description,
    costSummary: cost
      ? `Expected cost: about ${formatUsd(cost.totalUsd)} at the vendor.`
      : 'The cost of this run could not be estimated.',
    costBreakdown,
    confirmLabel: cost
      ? `${isReplacement ? 'Replace' : 'Generate'} for about ${formatUsd(cost.totalUsd)}`
      : isReplacement
        ? 'Replace them'
        : 'Generate them',
    isReplacement,
  };
};
