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

export const IDLE_LOOP_TOTAL = 7;
export const PORTRAIT_STILL_TOTAL = 6;

const isIdleLoopMissing = (entry) =>
  String(entry).includes('idle_loop');

const existingIdleLoopCount = (manifest) =>
  Object.values(manifest?.emotions ?? {}).filter((entry) =>
    Boolean(entry?.idleLoop)
  ).length;

const existingStillCount = (manifest) =>
  Object.values(manifest?.emotions ?? {}).filter((entry) =>
    Boolean(entry?.still)
  ).length;

const isStillMissing = (entry) => String(entry).includes('still');

/**
 * The card's state for one manifest.
 *
 * @param {Object|null} manifest A normalized emotion-media manifest.
 * @returns {{showFailure: boolean, withheld: boolean, isComplete: boolean,
 *   missingAssets: number, missingLoops: number, loopsComplete: boolean,
 *   onlyMissing: boolean, kind: string}} showFailure: the newest run left
 *   assets missing and said why. withheld: that run was withheld before any
 *   vendor call, so "generate anyway" is the offer. onlyMissing: a video
 *   run should build the absent loops rather than the whole set.
 */
export const emotionMediaStatusView = (manifest) => {
  const lastGeneration = manifest?.lastGeneration ?? null;
  const { total: failureCount } = countEmotionMediaFailures(
    lastGeneration?.failures
  );
  const missing = manifest?.missing ?? [];
  const missingAssets = missing.length;
  const missingLoops = missing.filter(isIdleLoopMissing).length;
  const missingStills = missing.filter(isStillMissing).length;
  const existingLoops = existingIdleLoopCount(manifest);
  const existingStills = existingStillCount(manifest);
  const loopsComplete = existingLoops > 0 && missingLoops === 0;
  const needsStills = existingStills === 0;
  const showFailure = Boolean(lastGeneration) && failureCount > 0 && missingAssets > 0;
  return {
    showFailure,
    withheld: showFailure && Boolean(emotionMediaWasWithheld(lastGeneration)),
    isComplete: loopsComplete,
    missingAssets,
    missingLoops,
    missingStills,
    needsStills,
    loopsComplete,
    onlyMissing: !loopsComplete,
    kind: needsStills ? 'stills_and_videos' : 'videos',
  };
};

/**
 * What a new reference image will do to generated media.
 *
 * Uploading a portrait stores the photo only. Emotion stills and idle-loop
 * videos wait for Create generative reference videos.
 *
 * @param {Object|null} manifest A normalized emotion-media manifest.
 * @param {number} [totalAssets] Unused; kept so existing callers stay valid.
 * @returns {{isComplete: boolean, missingAssets: number, onlyMissing: boolean,
 *   kind: string, generatesStills: boolean}}
 */
export const portraitUploadGenerationView = (
  manifest,
  totalAssets = PORTRAIT_STILL_TOTAL
) => ({
  isComplete: true,
  missingAssets: 0,
  onlyMissing: false,
  kind: 'stills',
  generatesStills: false,
  totalAssets,
});

/**
 * The generate button's label for that state.
 *
 * Idle loops are created only when the owner presses this control, so the
 * label never promises images.
 *
 * @param {{isComplete: boolean, missingLoops?: number, missingAssets: number}} view
 *   From emotionMediaStatusView.
 * @param {number} [totalAssets] How many idle loops a full set holds.
 * @returns {string} The button label.
 */
export const emotionMediaGenerateLabel = (view, totalAssets = IDLE_LOOP_TOTAL) => {
  if (view.isComplete) return 'Regenerate generative reference videos';
  const missingLoops = view.missingLoops ?? view.missingAssets;
  if (missingLoops > 0 && missingLoops < totalAssets) {
    return 'Create the missing generative reference videos';
  }
  return 'Generate reference videos';
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

const costForKind = (cost, kind) => {
  if (!cost) return null;
  if (kind === 'stills') {
    return {
      ...cost,
      idleLoops: 0,
      idleLoopsUsd: 0,
      totalUsd: cost.stillsUsd ?? 0,
    };
  }
  if (kind === 'videos') {
    return {
      ...cost,
      stills: 0,
      stillsUsd: 0,
      totalUsd: cost.idleLoopsUsd ?? 0,
    };
  }
  return cost;
};

const breakdownForKind = (cost, kind) => {
  if (!cost) return [];
  const lines = [];
  if (kind !== 'videos') {
    const stills = cost.stills ?? 0;
    lines.push(
      `${stills} image${stills === 1 ? '' : 's'} × ${formatUsd(cost.imageCostUsd)} = ${formatUsd(cost.stillsUsd)}`
    );
  }
  if (kind !== 'stills') {
    const idleLoops = cost.idleLoops ?? 0;
    lines.push(
      `${idleLoops} video${idleLoops === 1 ? '' : 's'} × ${cost.idleLoopSeconds}s × ${formatUsd(cost.videoCostPerSecondUsd)} per second = ${formatUsd(cost.idleLoopsUsd)}`
    );
  }
  lines.push('A clip the vendor refuses on content grounds is still charged.');
  return lines;
};

/**
 * What the confirmation asks before a generation run spends anything.
 *
 * `kind` is `stills` (legacy stills-only copy), `videos` (loops, stills
 * already exist), or `stills_and_videos` (first create: portraits then
 * loops). A full rebuild REPLACES the assets of that kind. A top-up builds
 * only what is absent.
 * Without an estimate from the server (an older API), the cost lines are
 * omitted rather than invented.
 *
 * @param {{isComplete: boolean, missingAssets: number, missingLoops?: number,
 *   onlyMissing: boolean, kind?: string}} view From emotionMediaStatusView or
 *   portraitUploadGenerationView.
 * @param {Object|null} generation The manifest's `generation` block.
 * @param {number|{kind?: string, totalAssets?: number}} [totalAssetsOrOptions]
 * @returns {{title: string, description: string, costSummary: string,
 *   costBreakdown: string[], confirmLabel: string, isReplacement: boolean}}
 */
export const emotionMediaGenerationConfirmation = (
  view,
  generation,
  totalAssetsOrOptions
) => {
  const options =
    typeof totalAssetsOrOptions === 'object' && totalAssetsOrOptions
      ? totalAssetsOrOptions
      : totalAssetsOrOptions != null
        ? { totalAssets: totalAssetsOrOptions }
        : {};
  const kind = view.kind ?? options.kind ?? 'videos';
  const defaultTotal = kind === 'stills' ? PORTRAIT_STILL_TOTAL : IDLE_LOOP_TOTAL;
  const totalAssets = options.totalAssets ?? defaultTotal;
  const missingCount =
    kind === 'videos'
      ? (view.missingLoops ?? view.missingAssets)
      : kind === 'stills_and_videos'
        ? (view.missingAssets ?? 0)
        : view.missingAssets;
  const isReplacement = !view.onlyMissing;
  const isFirstBuild = !isReplacement && missingCount >= totalAssets;
  const rawCost = isReplacement
    ? (generation?.costFullRebuild ?? null)
    : (generation?.costMissingOnly ?? null);
  const cost = costForKind(rawCost, kind);
  const stills = cost?.stills ?? 0;
  const idleLoops = cost?.idleLoops ?? 0;

  let description;
  let title;
  if (kind === 'stills') {
    title = isReplacement
      ? 'Replace the emotion images?'
      : isFirstBuild
        ? 'Generate the emotion images?'
        : 'Generate the missing images?';
    description = isReplacement
      ? 'This replaces every emotion image this avatar already has. The current portraits are deleted and rendered again from the reference image. Idle-loop videos are not created here — use Create generative reference videos for those.'
      : isFirstBuild
        ? `This generates ${stills || 'the'} emotion image${stills === 1 ? '' : 's'} from the reference image. Idle-loop videos are not created until you press Create generative reference videos.`
            .replace(/\s+/g, ' ')
            .trim()
        : `This generates only the ${missingCount} missing image${
            missingCount === 1 ? '' : 's'
          }. Everything already generated is kept.`;
  } else if (kind === 'stills_and_videos') {
    title = isReplacement
      ? 'Replace the emotion images and videos?'
      : 'Create the generative reference videos?';
    description = isReplacement
      ? 'This generates the emotion portraits and idle-loop videos from the reference image. Existing portraits and clips are replaced.'
      : `This generates ${stills || 'the'} emotion portrait${stills === 1 ? '' : 's'} and ${idleLoops || 'the'} idle video${idleLoops === 1 ? '' : 's'} from the reference image.`
          .replace(/\s+/g, ' ')
          .trim();
  } else {
    title = isReplacement
      ? 'Replace every generative reference video?'
      : isFirstBuild
        ? 'Create the generative reference videos?'
        : 'Create the missing generative reference videos?';
    description = isReplacement
      ? 'This replaces every idle-loop video this avatar already has. The current clips are deleted and rendered again from the emotion portraits — a regeneration never keeps the old clips.'
      : isFirstBuild
        ? `This generates ${idleLoops || 'the'} idle video${idleLoops === 1 ? '' : 's'} from the emotion portraits.`
            .replace(/\s+/g, ' ')
            .trim()
        : `This generates only the ${missingCount} missing video${
            missingCount === 1 ? '' : 's'
          }. Everything already generated is kept.`;
  }

  return {
    title,
    description,
    costSummary: cost
      ? `Expected cost: about ${formatUsd(cost.totalUsd)} at the vendor.`
      : 'The cost of this run could not be estimated.',
    costBreakdown: breakdownForKind(cost, kind),
    confirmLabel: cost
      ? `${isReplacement ? 'Replace' : kind === 'stills' ? 'Generate' : 'Create'} for about ${formatUsd(cost.totalUsd)}`
      : isReplacement
        ? 'Replace them'
        : kind === 'stills'
          ? 'Generate them'
          : 'Create them',
    isReplacement,
  };
};
