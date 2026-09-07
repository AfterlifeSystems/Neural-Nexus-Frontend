// src/components/analytics/UsageAnalyticsSection.jsx
//
// The switch for opt-in usage analytics, shown in the personal avatar's
// settings and in account settings. Consent belongs to the account, so the
// same switch appears in both places and flipping either changes the one
// record. The section says exactly what is recorded, and offers to delete
// what has been recorded so far.

import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { BarChart3, Trash2 } from 'lucide-react';
import Switch from '../ui/Switch';
import { useUsageAnalytics } from '../../context/UsageAnalyticsContext';

/**
 * @param {Object} props
 * @param {'avatar_settings'|'account_settings'} props.source Where this
 *   switch lives, recorded with the choice.
 */
const UsageAnalyticsSection = ({ source }) => {
  const {
    consent,
    isLoaded,
    isEnabled,
    isFeatureAvailable,
    isSaving,
    updateConsent,
    deleteRecordedData,
  } = useUsageAnalytics();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleToggle = async (nextEnabled) => {
    try {
      await updateConsent(nextEnabled, source);
      toast.success(
        nextEnabled
          ? 'Usage analytics is on. Thank you for helping Neural Nexus improve.'
          : 'Usage analytics is off. Nothing more is recorded.'
      );
    } catch (updateError) {
      toast.error(updateError?.message ?? 'The choice could not be saved.');
    }
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        'Delete everything usage analytics has recorded for this account? This cannot be undone.'
      )
    ) {
      return;
    }
    setIsDeleting(true);
    try {
      const result = await deleteRecordedData();
      const counts = result?.deleted ?? {};
      toast.success(
        `Deleted ${counts.events ?? 0} recorded actions and ${counts.screenshots ?? 0} page captures.`
      );
    } catch (deleteError) {
      toast.error(deleteError?.message ?? 'The recorded data could not be deleted.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="bg-black/60 backdrop-blur-lg rounded-2xl border border-white/10 p-6"
      data-usage-analytics-section={source}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <BarChart3 size={20} className="text-amber-400/80 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-neutral-100">
              Usage analytics
            </h3>
            <p className="text-sm text-white/60 mt-1">
              Help Neural Nexus improve. While this is on, the application
              records the actions you take in Neural Nexus (what you click,
              which screens you open, which requests the application makes)
              and periodically captures a picture of this page, which an AI
              model describes so the team can see what people are doing,
              have done, or are trying to do. Only this page is captured,
              never other windows; passwords and hidden fields are left out;
              no browser permission is asked. Everything is stored under your
              account and forgotten after a retention window.
            </p>
          </div>
        </div>
        <Switch
          checked={isEnabled}
          onChange={handleToggle}
          label="Usage analytics"
          showLabel
          onLabel="On"
          offLabel="Off"
          busy={isSaving || !isLoaded}
          disabled={!isFeatureAvailable}
        />
      </div>
      {!isFeatureAvailable && (
        <p className="mt-3 text-xs text-white/40">
          Usage analytics is not available on this deployment.
        </p>
      )}
      {isLoaded && consent?.recorded && (
        <p className="mt-3 text-xs text-white/40">
          Last changed{' '}
          {consent.updated_at
            ? new Date(consent.updated_at).toLocaleString()
            : 'at signup'}
          {consent.source ? ` (${consent.source.replace('_', ' ')})` : ''}.
        </p>
      )}
      <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting || !isLoaded}
          className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-black/50 hover:bg-white/10 border border-white/10 text-white/70 disabled:opacity-50"
        >
          <Trash2 size={14} />
          {isDeleting ? 'Deleting…' : 'Delete what has been recorded'}
        </button>
        <span className="text-xs text-white/40">
          Turning the switch off stops recording at once; deleting removes
          what was recorded before.
        </span>
      </div>
    </div>
  );
};

export default UsageAnalyticsSection;
