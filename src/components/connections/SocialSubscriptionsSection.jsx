// src/components/connections/SocialSubscriptionsSection.jsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  BadgeCheck,
  CircleAlert,
  Loader2,
  RefreshCw,
  Radio,
  Download,
} from 'lucide-react';
import ConnectorIcon from '../icons/ConnectorIcon';
import {
  listSocialSubscriptions,
  pullMoreSocialContent,
  verifySocialAccountOwnership,
} from '../../services/avatarService';
import {
  OWNERSHIP_PROVEN,
  describeSubscriptionRow,
  summariseSubscriptions,
} from './socialSubscriptionStatus';

/**
 * What the owner's own accounts are publishing into their avatar.
 *
 * This panel exists to answer one question the rest of the settings screen
 * cannot: is this actually working? A connected account that was never proven
 * to be the owner's, or one whose subscription lapsed, looks exactly like a
 * working one in the ordinary connections list — it is present, it is toggled
 * on, and nothing it publishes is reaching the avatar. So every row states
 * both facts that decide that, and an account that is contributing nothing
 * says why and offers the action that fixes it.
 *
 * Personal-avatar only, like the section that renders it: these accounts are a
 * claim about a real person, and only the avatar that depicts its own creator
 * can make one.
 */

const PILL_ICONS = {
  'Verified yours': BadgeCheck,
  'Not verified': CircleAlert,
  Subscribed: Radio,
};

const Pill = ({ tone = 'neutral', icon: Icon, children }) => {
  const tones = {
    good: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/30',
    warn: 'bg-amber-400/10 text-amber-200 border-amber-400/30',
    neutral: 'bg-white/5 text-neutral-300 border-white/15',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] whitespace-nowrap ${tones[tone]}`}
    >
      {Icon && <Icon className="w-3 h-3" aria-hidden="true" />}
      {children}
    </span>
  );
};

const SocialSubscriptionsSection = () => {
  const [rows, setRows] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyKey, setBusyKey] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    try {
      const answer = await listSocialSubscriptions();
      setRows(answer?.accounts || []);
      setEvents(answer?.recent_events || []);
      setError(null);
    } catch (loadError) {
      setError(
        loadError?.message ||
          'Your connected accounts could not be read just now.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleVerify = async (accountKey) => {
    setBusyKey(accountKey);
    setNotice(null);
    try {
      const answer = await verifySocialAccountOwnership(accountKey);
      const state = answer?.ownership?.state;
      setNotice(
        state === OWNERSHIP_PROVEN
          ? 'Verified. Everything you publish there will now reach your avatar.'
          : answer?.ownership?.detail || 'That account could not be verified yet.',
      );
      await load();
    } catch (verifyError) {
      setNotice(verifyError?.message || 'The check could not be completed.');
    } finally {
      setBusyKey(null);
    }
  };

  const handlePullMore = async (accountKey) => {
    setBusyKey(accountKey);
    setNotice(null);
    try {
      const answer = await pullMoreSocialContent(accountKey);
      setNotice(
        answer?.detail || 'Reading further into what that account has published.',
      );
    } catch (pullError) {
      setNotice(pullError?.message || 'That pull could not be started.');
    } finally {
      setBusyKey(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-white/50 p-3">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        Reading your accounts…
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-amber-300 p-3">{error}</p>;
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-white/50 p-3">
        Connect an account you publish from — a channel, a profile, a podcast —
        and everything you post there will keep your avatar current on its own.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/45">{summariseSubscriptions(rows)}</p>

      {notice && (
        <p className="text-xs text-neutral-300 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
          {notice}
        </p>
      )}

      {rows.map((row) => {
        const { pills, explanation, action } = describeSubscriptionRow(row);
        const isBusy = busyKey === row.account_key;
        return (
          <div
            key={row.account_key}
            className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-black/60 border border-white/10 rounded-xl min-w-0"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <ConnectorIcon iconKey={row.provider} />
              <div className="min-w-0 flex-1">
                <p className="text-neutral-200 truncate">
                  {row.display_label}
                  {row.handle && (
                    <span className="text-white/40"> · @{row.handle}</span>
                  )}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  {pills.map((pill) => (
                    <Pill
                      key={pill.text}
                      tone={pill.tone}
                      icon={PILL_ICONS[pill.text]}
                    >
                      {pill.text}
                    </Pill>
                  ))}
                </div>
                <p className="text-xs text-white/45 mt-1">{explanation}</p>
                {row.verification_token && (
                  <p className="text-xs text-white/45 mt-1">
                    Put this anywhere on the page or in the feed description,
                    then press Check again:{' '}
                    <code className="text-neutral-200 bg-white/10 px-1.5 py-0.5 rounded select-all">
                      {row.verification_token}
                    </code>
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 shrink-0">
              {action === 'verify' && (
                <button
                  type="button"
                  onClick={() => handleVerify(row.account_key)}
                  disabled={isBusy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-400/15 hover:bg-amber-400/25 text-amber-200 rounded-lg border border-amber-400/30 transition-colors disabled:opacity-50"
                >
                  {isBusy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  Check again
                </button>
              )}
              {action === 'pull_more' && (
                <button
                  type="button"
                  onClick={() => handlePullMore(row.account_key)}
                  disabled={isBusy}
                  title="Read further back through what you have already published"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-100/10 hover:bg-neutral-100/15 border border-neutral-700 text-neutral-300 text-xs transition-colors disabled:opacity-50"
                >
                  {isBusy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  Pull more
                </button>
              )}
            </div>
          </div>
        );
      })}

      {events.length > 0 && (
        <div className="pt-1">
          <p className="text-xs uppercase tracking-wide text-white/40 mb-2">
            Recently collected
          </p>
          <ul className="space-y-1">
            {events.slice(0, 8).map((event, index) => (
              <li
                key={`${event.url || 'event'}-${index}`}
                className="text-xs text-white/55 truncate"
              >
                <span className="text-white/35">{event.provider}</span>{' '}
                {event.title || event.url}
                {event.state && event.state !== 'ingested' && (
                  <span className="text-amber-300/70"> — {event.state}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SocialSubscriptionsSection;
