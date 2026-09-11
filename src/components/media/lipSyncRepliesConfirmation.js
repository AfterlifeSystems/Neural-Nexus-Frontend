// src/components/media/lipSyncRepliesConfirmation.js
//
// What the settings screen asks before lip-synced video replies are turned
// on. Each spoken reply then spends at the video vendor; the owner sees that
// price (and whether their plan may spend) before the setting flips and
// before any clip is made.

import { formatUsd } from './emotionMediaStatusView.js';

const EXAMPLE_REPLY_SECONDS = 6;

/**
 * What the confirmation asks before lip-synced video replies are enabled.
 *
 * @param {Object|null} generation The manifest's camelCase `generation` block.
 * @returns {{title: string, description: string, costSummary: string,
 *   costBreakdown: string[], confirmLabel: string}}
 */
export function lipSyncRepliesConfirmation(generation) {
  const cost =
    generation?.costFullRebuild ?? generation?.costMissingOnly ?? null;
  const perSecond = Number(cost?.videoCostPerSecondUsd);
  const hasRate = Number.isFinite(perSecond) && perSecond > 0;
  const exampleSeconds =
    Number(cost?.idleLoopSeconds) > 0
      ? Number(cost.idleLoopSeconds)
      : EXAMPLE_REPLY_SECONDS;
  const exampleUsd = hasRate ? perSecond * exampleSeconds : null;

  return {
    title: 'Enable lip-synced video replies?',
    description:
      'Each spoken reply will generate a new video of this avatar saying those words. Nothing is generated until a reply is spoken. This is billed at the vendor per second of speech.',
    costSummary: hasRate
      ? `Expected cost: about ${formatUsd(perSecond)} per second of speech at the vendor.`
      : 'The cost of this setting could not be estimated.',
    costBreakdown: hasRate
      ? [
          `${formatUsd(perSecond)} per second of spoken reply (about ${formatUsd(exampleUsd)} for a ${exampleSeconds}-second reply).`,
          'A clip the vendor refuses on content grounds is still charged.',
        ]
      : [],
    confirmLabel: hasRate
      ? `Enable for about ${formatUsd(perSecond)} per second`
      : 'Enable lip-synced replies',
  };
}

/**
 * Whether this viewer may turn lip-synced video replies on.
 *
 * When the generation block is missing (an older API, or the read failed),
 * the control stays available and the confirmation states that the cost
 * could not be estimated. A known refusal — the plan is below the required
 * tier, or the deployment has generation switched off — keeps the control
 * off.
 *
 * @param {Object|null} generation The manifest's camelCase `generation` block.
 * @returns {boolean}
 */
export function lipSyncRepliesMayEnable(generation) {
  if (!generation) return true;
  return Boolean(generation.allowed);
}
