// src/components/media/LipSyncRepliesSetting.jsx
import React, { useState } from 'react';
import useEmotionMedia from '../../hooks/useEmotionMedia';
import useAvatarVideoReplies from '../../hooks/useAvatarVideoReplies';
import Switch from '../ui/Switch';
import GenerationConfirmation from './GenerationConfirmation';
import { normalizeGenerationBlock } from './emotionMediaStatusView';
import {
  lipSyncRepliesConfirmation,
  lipSyncRepliesMayEnable,
} from './lipSyncRepliesConfirmation';

/**
 * Turn lip-synced video replies on from avatar settings.
 *
 * Off until the owner confirms. Confirming shows the vendor price and is
 * refused when the plan is below the required tier, so a clip is never made
 * from a single press on the live-stage bar.
 *
 * @param {Object} parameters
 * @param {string} parameters.assistantId The avatar.
 */
const LipSyncRepliesSetting = ({ assistantId }) => {
  const { videoEnabled, setVideoEnabled } = useAvatarVideoReplies(assistantId);
  const { manifest } = useEmotionMedia(assistantId);
  const generation = normalizeGenerationBlock(manifest?.generation);
  const mayEnable = lipSyncRepliesMayEnable(generation);
  const [confirming, setConfirming] = useState(false);
  const blockedByTier = Boolean(generation) && !generation.tierAllows;
  const blockedByConfig =
    Boolean(generation) && generation.tierAllows && !generation.configured;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-white/70">
          Enable lip-synced video replies
        </p>
        <Switch
          checked={videoEnabled}
          disabled={!videoEnabled && !mayEnable}
          onChange={(next) => {
            if (!next) {
              setConfirming(false);
              setVideoEnabled(false);
              return;
            }
            if (!mayEnable) return;
            setConfirming(true);
          }}
          label="Enable lip-synced video replies"
        />
      </div>
      <p className="text-xs text-white/40">
        Each spoken reply generates a new video of this avatar saying those
        words. The cost is shown before this is turned on, and before any clip
        is made.
      </p>
      {blockedByTier && (
        <p className="text-xs text-white/50">
          Lip-synced video replies are created on the {generation.requiredTier}{' '}
          plan.
        </p>
      )}
      {blockedByConfig && (
        <p className="text-xs text-white/50">
          Lip-synced video generation is switched off for this deployment.
        </p>
      )}
      {confirming && (
        <GenerationConfirmation
          confirmation={lipSyncRepliesConfirmation(generation)}
          starting={false}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setVideoEnabled(true);
            setConfirming(false);
          }}
        />
      )}
    </div>
  );
};

export default LipSyncRepliesSetting;
