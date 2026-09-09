// src/components/salvage/AvatarStoragePanel.jsx
//
// INERT SALVAGE — nothing renders this component yet.
//
// The per-avatar storage panel, salvaged on 2026-09-09 from commit `c62c798`,
// which was reachable from no branch at all. Upstream this was a
// `renderStorageCard` helper plus its state and effects spliced into
// `AvatarSettings.jsx`; it is reconstituted here as a self-contained component
// so the salvage does not touch that file.
//
// The two endpoints it calls are not served by the API yet either — they are
// salvaged on an unregistered router in the API repository. Read
// `src/api/salvage/README.md` there before wiring this up.
//
// To activate: import this component in `AvatarSettings.jsx` and render
// `<AvatarStoragePanel assistantId={assistantId} user={user} />` where the
// other cards are rendered.

import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { HardDrive } from 'lucide-react';

import {
  getAvatarStorage,
  purchaseAvatarStorage,
} from '../../services/avatarStorageAndAdapter';

/**
 * Human-readable byte size, in the binary units the API reports.
 *
 * @param {number|null|undefined} bytes
 * @returns {string}
 */
const describeBytes = (bytes) => {
  if (bytes == null) return '—';
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GiB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KiB`;
  return `${bytes} B`;
};

/**
 * Bytes used against the tier allotment, plus the add-on pack offer.
 *
 * @param {Object} parameters
 * @param {string} parameters.assistantId
 * @param {Object} parameters.user The signed-in user; the panel stays idle without one.
 */
export default function AvatarStoragePanel({ assistantId, user }) {
  const [storage, setStorage] = useState(null);
  const [isBuyingStorage, setIsBuyingStorage] = useState(false);

  useEffect(() => {
    if (!assistantId || !user) return undefined;
    let cancelled = false;
    getAvatarStorage(assistantId)
      .then((storageReport) => {
        if (!cancelled) setStorage(storageReport);
      })
      .catch((storageError) => {
        console.error('Loading avatar storage failed:', storageError);
      });
    return () => {
      cancelled = true;
    };
  }, [assistantId, user]);

  const handleBuyStorage = async () => {
    setIsBuyingStorage(true);
    try {
      const purchase = await purchaseAvatarStorage(assistantId, 1);
      if (purchase?.url) {
        window.location.assign(purchase.url);
      } else {
        toast.error('Could not start the storage purchase.');
      }
    } catch (purchaseError) {
      toast.error(purchaseError.message || 'Could not start the storage purchase.');
    } finally {
      setIsBuyingStorage(false);
    }
  };

  const used = storage?.used_bytes ?? 0;
  const allotment = storage?.allotment_bytes ?? 0;
  const percent = allotment > 0 ? Math.min(100, Math.round((used / allotment) * 100)) : 0;

  return (
    <div className="bg-black/60 backdrop-blur-lg rounded-2xl border border-white/10 p-6">
      <h3 className="text-xl font-semibold text-neutral-200 mb-2 flex items-center gap-2">
        <HardDrive size={22} className="text-amber-300" />
        Storage
      </h3>
      <p className="text-sm text-white/60 mb-3">
        Everything this avatar knows — documents, quotes, transcripts, analysis —
        counts against the avatar&apos;s storage. Add a pack for more.
      </p>
      <div className="w-full h-2 rounded bg-white/10 overflow-hidden mb-2">
        <div
          className={`h-full ${percent >= 90 ? 'bg-red-400' : 'bg-amber-400'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-sm text-neutral-300 mb-3">
        {describeBytes(used)} of {describeBytes(allotment)} used
        {storage?.addon_packs
          ? ` (includes ${storage.addon_packs} add-on pack${storage.addon_packs === 1 ? '' : 's'})`
          : ''}
      </p>
      <button
        type="button"
        onClick={handleBuyStorage}
        disabled={isBuyingStorage || !storage?.purchase_available}
        title={storage?.purchase_available ? '' : 'Storage packs are not available yet.'}
        className="px-4 py-2 rounded bg-black/60 text-neutral-200 border border-neutral-700 hover:bg-neutral-900 disabled:opacity-50"
      >
        {isBuyingStorage
          ? 'Opening checkout…'
          : `Add ${describeBytes(storage?.pack_bytes ?? 1024 ** 3)} for $${(
              storage?.pack_price_usd ?? 2
            ).toFixed(2)}`}
      </button>
    </div>
  );
}
