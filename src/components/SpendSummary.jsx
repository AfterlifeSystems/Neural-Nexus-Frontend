// SpendSummary.jsx
//
// What Neural Nexus actually spent, and on what — shown to the administrator at
// the top of the Billing page.
//
// The customer portal below the panel reads usage from Stripe's meters, and the
// portal runs against the Stripe test environment, so the portal can only show
// test-mode usage. Vendor spend is real whether or not anybody is charged, so
// this panel reads GET /billing/spend instead: the API's own cost ledger
// (api_metrics, one row per paid call) broken down by category, model, day, and
// account, next to each vendor's own figures. The ledger and the vendors are
// shown side by side and never added together, because the ledger is a floor —
// calls that write no ledger row are missing from the ledger but present in the
// vendors' figures.

import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, RefreshCw, Receipt } from 'lucide-react';

import { getBillingSpend } from '../services/billingSpendApi';
import {
  SPEND_RANGE_OPTIONS,
  SPEND_SCOPE_OPTIONS,
  browserTimeZone,
  describeVendorStatus,
  formatCount,
  formatUsd,
  shareOfWholePercent,
} from './billingSpend';

const segmentButtonClass = (isSelected) =>
  `px-3 py-1.5 text-xs rounded-md transition ${
    isSelected
      ? 'bg-white/15 text-neutral-100'
      : 'text-white/60 hover:text-neutral-200 hover:bg-white/5'
  }`;

const SegmentedChoice = ({ label, options, selectedValue, onSelect }) => (
  <div
    role="group"
    aria-label={label}
    className="inline-flex gap-1 rounded-lg border border-white/10 bg-black/40 p-1"
  >
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        aria-pressed={selectedValue === option.value}
        className={segmentButtonClass(selectedValue === option.value)}
        onClick={() => onSelect(option.value)}
      >
        {option.label}
      </button>
    ))}
  </div>
);

/** One spend category, expandable into the models the category's calls used. */
const CategoryRow = ({ category, totalCostUsd }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasSeveralModels = category.models.length > 1;
  const onlyModelName =
    category.models.length === 1 ? category.models[0].model_name : null;
  return (
    <li className="py-2">
      <button
        type="button"
        className="w-full text-left"
        onClick={() => setIsExpanded((wasExpanded) => !wasExpanded)}
        aria-expanded={isExpanded}
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="flex items-center gap-1 text-sm text-neutral-200 min-w-0">
            {isExpanded ? (
              <ChevronDown size={14} className="shrink-0 text-white/40" />
            ) : (
              <ChevronRight size={14} className="shrink-0 text-white/40" />
            )}
            <span className="truncate">{category.label}</span>
            {onlyModelName && (
              <span className="truncate text-xs text-white/40">
                · {onlyModelName}
              </span>
            )}
          </span>
          <span className="shrink-0 text-sm tabular-nums text-neutral-100">
            {formatUsd(category.cost_usd)}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-3">
          <div className="h-1.5 flex-grow rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-400/70"
              style={{
                width: `${shareOfWholePercent(category.cost_usd, totalCostUsd)}%`,
              }}
            />
          </div>
          <span className="shrink-0 text-xs tabular-nums text-white/40">
            {formatCount(category.call_count)} calls
          </span>
        </div>
      </button>
      {isExpanded && (
        <ul className="mt-2 ml-5 space-y-1">
          {category.models.map((model) => (
            <li
              key={model.model_name || 'unnamed'}
              className="flex justify-between gap-3 text-xs text-white/60"
            >
              <span className="truncate">
                {model.model_name || 'model not recorded'}
                {hasSeveralModels || model.total_tokens
                  ? ` · ${formatCount(model.call_count)} calls`
                  : ''}
                {model.total_tokens
                  ? ` · ${formatCount(model.total_tokens)} tokens`
                  : ''}
              </span>
              <span className="tabular-nums">{formatUsd(model.cost_usd)}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
};

/** One vendor's own figures for the window. */
const VendorCard = ({ vendorReport }) => {
  const statusSentence = describeVendorStatus(vendorReport);
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3 min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-neutral-200">{vendorReport.label}</span>
        {vendorReport.status === 'ok' &&
          vendorReport.total_cost_usd !== null && (
            <span className="text-sm tabular-nums text-neutral-100">
              {formatUsd(vendorReport.total_cost_usd)}
            </span>
          )}
      </div>
      {statusSentence ? (
        <p className="mt-1 text-xs text-amber-300/80 break-words">
          {statusSentence}
        </p>
      ) : (
        <>
          {vendorReport.window_note && (
            <p className="mt-1 text-xs text-white/50">
              {vendorReport.window_note}
            </p>
          )}
          {(vendorReport.line_items || [])
            .filter((lineItem) => lineItem.cost_usd !== undefined)
            .slice(0, 8)
            .map((lineItem) => (
              <div
                key={lineItem.label}
                className="mt-1 flex justify-between gap-2 text-xs text-white/60"
              >
                <span className="truncate">{lineItem.label}</span>
                <span className="tabular-nums">
                  {formatUsd(lineItem.cost_usd)}
                </span>
              </div>
            ))}
        </>
      )}
    </div>
  );
};

const SpendSummary = () => {
  const [rangeName, setRangeName] = useState('today');
  const [scopeName, setScopeName] = useState('platform');
  const [spendReport, setSpendReport] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showRecentCalls, setShowRecentCalls] = useState(false);

  const loadSpendReport = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setSpendReport(
        await getBillingSpend({
          range: rangeName,
          scope: scopeName,
          timezone: browserTimeZone(),
        })
      );
    } catch (spendError) {
      setLoadError(
        spendError?.message || 'The spend report could not be loaded.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [rangeName, scopeName]);

  useEffect(() => {
    loadSpendReport();
  }, [loadSpendReport]);

  const recordedSpend = spendReport?.recorded;
  const categories = recordedSpend?.categories || [];
  const days = recordedSpend?.days || [];
  const largestDayCostUsd = Math.max(0, ...days.map((day) => day.cost_usd));
  const accounts = recordedSpend?.accounts || [];

  return (
    <section
      aria-label="Spend"
      className="shrink-0 rounded-2xl border border-white/10 bg-black/70 backdrop-blur-sm p-4"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-medium text-neutral-200 flex items-center gap-2">
          <Receipt size={16} />
          Spend
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <SegmentedChoice
            label="Window"
            options={SPEND_RANGE_OPTIONS}
            selectedValue={rangeName}
            onSelect={setRangeName}
          />
          <SegmentedChoice
            label="Scope"
            options={SPEND_SCOPE_OPTIONS}
            selectedValue={scopeName}
            onSelect={setScopeName}
          />
          <button
            type="button"
            onClick={loadSpendReport}
            disabled={isLoading}
            aria-label="Refresh spend"
            className="p-2 rounded-lg border border-white/10 bg-black/40 text-white/60 hover:text-neutral-200 disabled:opacity-50"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loadError && <p className="mt-3 text-sm text-red-300/90">{loadError}</p>}

      {recordedSpend && (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="min-w-0">
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-3xl font-semibold tabular-nums text-neutral-100">
                {formatUsd(recordedSpend.total_cost_usd)}
              </span>
              <span className="text-xs text-white/50">
                recorded across {formatCount(recordedSpend.call_count)} paid
                calls
              </span>
            </div>

            {categories.length === 0 ? (
              <p className="mt-3 text-sm text-white/50">
                No paid calls were recorded in this window.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-white/5">
                {categories.map((category) => (
                  <CategoryRow
                    key={category.inference_type}
                    category={category}
                    totalCostUsd={recordedSpend.total_cost_usd}
                  />
                ))}
              </ul>
            )}

            {days.length > 1 && (
              <div className="mt-4">
                <h3 className="text-xs uppercase tracking-wide text-white/40">
                  By day
                </h3>
                <div className="mt-2 flex items-end gap-1 h-20">
                  {days.map((day) => (
                    <div
                      key={day.day}
                      title={`${day.day}: ${formatUsd(day.cost_usd)} over ${formatCount(day.call_count)} calls`}
                      className="flex-1 min-w-[4px] rounded-t bg-emerald-400/60"
                      style={{
                        height: `${Math.max(2, shareOfWholePercent(day.cost_usd, largestDayCostUsd))}%`,
                      }}
                    />
                  ))}
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-white/40">
                  <span>{days[0].day}</span>
                  <span>{days[days.length - 1].day}</span>
                </div>
              </div>
            )}
          </div>

          <div className="min-w-0 space-y-3">
            <h3 className="text-xs uppercase tracking-wide text-white/40">
              Reported by the vendors
            </h3>
            {(spendReport.vendors || []).map((vendorReport) => (
              <VendorCard
                key={vendorReport.vendor}
                vendorReport={vendorReport}
              />
            ))}
            {scopeName === 'platform' && accounts.length > 0 && (
              <div>
                <h3 className="text-xs uppercase tracking-wide text-white/40">
                  By account
                </h3>
                <ul className="mt-1 space-y-1">
                  {accounts.map((account) => (
                    <li
                      key={account.user_id || 'none'}
                      className="flex justify-between gap-2 text-xs text-white/60"
                    >
                      <span className="truncate font-mono">
                        {account.user_id || 'no account recorded'}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {formatUsd(account.cost_usd)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {recordedSpend && recordedSpend.recent_calls?.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-white/50 hover:text-neutral-200"
            onClick={() => setShowRecentCalls((wasShown) => !wasShown)}
            aria-expanded={showRecentCalls}
          >
            {showRecentCalls ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )}
            Most recent paid calls
          </button>
          {showRecentCalls && (
            <ul className="mt-2 space-y-1">
              {recordedSpend.recent_calls.map((recentCall, i) => (
                <li
                  key={`${recentCall.created_at}-${i}`}
                  className="flex justify-between gap-3 text-xs text-white/60"
                >
                  <span className="truncate">
                    {new Date(recentCall.created_at).toLocaleTimeString()} ·{' '}
                    {recentCall.label}
                    {recentCall.model_name ? ` · ${recentCall.model_name}` : ''}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {formatUsd(recentCall.cost_usd)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="mt-4 text-xs text-white/40">
        Real spend, independent of Stripe and of whether anybody was charged.
        The recorded figure is a floor: Tavily searches, voice cloning, and
        deep-research model calls write no ledger row, so the vendors&apos; own
        figures are the ones to trust.
      </p>
    </section>
  );
};

export default SpendSummary;
