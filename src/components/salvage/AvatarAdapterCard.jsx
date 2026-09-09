// src/components/salvage/AvatarAdapterCard.jsx
//
// INERT SALVAGE — nothing renders this component yet.
//
// The trained-adapter card, salvaged on 2026-09-09 from commit `d8d2c93`,
// which was reachable from no branch at all. Upstream this was a
// `renderAdapterCard` helper plus its state, effects, and handlers spliced
// into `AvatarSettings.jsx`; it is reconstituted here as a self-contained
// component so the salvage does not touch that file.
//
// The four endpoints it calls are not served by the API yet either — they are
// salvaged on an unregistered router in the API repository, and the adapter
// service itself still lives only on the `z-anubis-adapter` branch. Read
// `src/api/salvage/README.md` in the API repository before wiring this up.
//
// To activate: import this component in `AvatarSettings.jsx` and render
// `<AvatarAdapterCard assistantId={assistantId} user={user} />` where the
// other cards are rendered.

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Sparkles } from 'lucide-react';

import {
  cancelAvatarAdapterTraining,
  getAvatarAdapter,
  streamAdapterTrainingProgress,
  trainAvatarAdapter,
} from '../../services/avatarStorageAndAdapter';

/**
 * The avatar's trained-adapter state, with train / retrain / cancel controls
 * and a live progress line while training runs.
 *
 * @param {Object} parameters
 * @param {string} parameters.assistantId
 * @param {Object} parameters.user The signed-in user; the card stays idle without one.
 */
export default function AvatarAdapterCard({ assistantId, user }) {
  const [adapterState, setAdapterState] = useState(null);
  const [adapterProgress, setAdapterProgress] = useState('');
  const [isTrainingAdapter, setIsTrainingAdapter] = useState(false);

  const loadAdapterState = useCallback(async () => {
    if (!assistantId || !user) return;
    try {
      setAdapterState(await getAvatarAdapter(assistantId));
    } catch (adapterError) {
      console.error('Loading the adapter state failed:', adapterError);
    }
  }, [assistantId, user]);

  useEffect(() => {
    loadAdapterState();
  }, [loadAdapterState]);

  useEffect(() => {
    if (adapterState?.adapter?.status !== 'training') return undefined;
    const controller = new AbortController();
    streamAdapterTrainingProgress(
      assistantId,
      (event) => {
        if (event.type === 'training_done') {
          setAdapterProgress(`Training ${event.status}.`);
          loadAdapterState();
          return;
        }
        if (event.stage === 'training_step') {
          setAdapterProgress(
            `Step ${event.step}${event.total_steps ? ` of ${event.total_steps}` : ''}` +
              (event.reward != null ? ` · reward ${Number(event.reward).toFixed(3)}` : '')
          );
        } else if (event.stage) {
          setAdapterProgress(String(event.stage).replace(/_/g, ' '));
        }
      },
      controller.signal
    ).catch(() => {});
    return () => controller.abort();
  }, [adapterState?.adapter?.status, assistantId, loadAdapterState]);

  const handleTrainAdapter = async () => {
    setIsTrainingAdapter(true);
    try {
      await trainAvatarAdapter(assistantId);
      toast.success('Adapter training started.');
      await loadAdapterState();
    } catch (trainError) {
      toast.error(trainError.message || 'Could not start adapter training.');
    } finally {
      setIsTrainingAdapter(false);
    }
  };

  const handleCancelAdapterTraining = async () => {
    try {
      await cancelAvatarAdapterTraining(assistantId);
      toast.success('Cancellation requested.');
      await loadAdapterState();
    } catch (cancelError) {
      toast.error(cancelError.message || 'Could not cancel the training.');
    }
  };

  const adapter = adapterState?.adapter ?? {};
  const status = adapter.status ?? 'none';

  return (
    <div className="bg-black/60 backdrop-blur-lg rounded-2xl border border-white/10 p-6">
      <h3 className="text-xl font-semibold text-neutral-200 mb-2 flex items-center gap-2">
        <Sparkles size={22} className="text-amber-300" />
        Trained adapter
      </h3>
      <p className="text-sm text-white/60 mb-3">
        A LoRA adapter trained on this avatar&apos;s own words teaches the model the
        real cadence, humor, and emotional cues. Once trained, replies come
        through the adapter and fall back to the standard model if the adapter
        service is unavailable. Premium only.
      </p>
      <p className="text-sm text-neutral-300 mb-3">
        Status:{' '}
        <span className="text-neutral-100">
          {status === 'trained'
            ? `trained ${adapter.trained_at ? new Date(adapter.trained_at).toLocaleString() : ''}`
            : status === 'training'
              ? `training${adapterProgress ? ` — ${adapterProgress}` : '…'}`
              : status === 'error'
                ? `failed — ${adapter.error ?? 'unknown error'}`
                : 'not trained yet'}
        </span>
        {adapterState && !adapterState.adapter_service_configured && (
          <span className="block text-xs text-white/50 mt-1">
            The adapter service is not configured on this deployment.
          </span>
        )}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleTrainAdapter}
          disabled={
            isTrainingAdapter ||
            status === 'training' ||
            !adapterState?.adapter_service_configured
          }
          className="px-4 py-2 rounded bg-black/60 text-neutral-200 border border-neutral-700 hover:bg-neutral-900 disabled:opacity-50"
        >
          {isTrainingAdapter
            ? 'Starting…'
            : status === 'trained'
              ? 'Retrain adapter'
              : 'Train adapter'}
        </button>
        {status === 'training' && (
          <button
            type="button"
            onClick={handleCancelAdapterTraining}
            className="px-4 py-2 rounded bg-black/60 text-red-300 border border-red-900/60 hover:bg-red-950/40"
          >
            Cancel training
          </button>
        )}
      </div>
    </div>
  );
}
