import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Activity } from 'lucide-react';
import {
  deleteAvatarMotionTracks,
  getAvatarMotionProfile,
} from '../../services/avatarService';

const CHANNEL_LABELS = {
  body_left_hand: 'Left hand',
  body_right_hand: 'Right hand',
  head: 'Head',
  face: 'Face',
};

const DIMENSION_LABELS = {
  body_left_hand: ['x (own left +)', 'y (down +)', 'z (toward camera −)'],
  body_right_hand: ['x (own left +)', 'y (down +)', 'z (toward camera −)'],
  head: ['yaw', 'pitch', 'roll'],
};

const SERIES_COLORS = [
  '#fbbf24',
  '#38bdf8',
  '#f472b6',
  '#a3e635',
  '#c084fc',
  '#fb923c',
];

/**
 * Plot one prototype trajectory: each named coordinate as its own line over
 * normalized time — the per-joint chart from the design references, drawn
 * from the stored numbers rather than described.
 */
function PrototypeChart({ primitive }) {
  const rows = useMemo(() => primitive.prototype ?? [], [primitive.prototype]);
  const width = 220;
  const height = 72;
  const dimensions = rows[0]?.length ?? 0;
  const labels = DIMENSION_LABELS[primitive.channel] ?? [];
  const paths = useMemo(() => {
    if (!rows.length || !dimensions) return [];
    return Array.from({ length: Math.min(dimensions, 6) }, (_, dimension) => {
      const values = rows.map((row) => row[dimension] ?? 0);
      const points = values.map((value, index) => {
        const x = (index / Math.max(rows.length - 1, 1)) * (width - 8) + 4;
        const y = height / 2 - value * (height / 2 - 6);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      });
      return { dimension, d: `M${points.join(' L')}` };
    });
  }, [rows, dimensions]);
  return (
    <figure className="flex flex-col gap-1">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full max-w-[220px] h-auto rounded bg-black/30 border border-white/10"
        role="img"
        aria-label={`${CHANNEL_LABELS[primitive.channel] ?? primitive.channel} movement over time`}
      >
        <line
          x1="0"
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="1"
        />
        {paths.map(({ dimension, d }) => (
          <path
            key={dimension}
            d={d}
            fill="none"
            stroke={SERIES_COLORS[dimension % SERIES_COLORS.length]}
            strokeWidth="1.5"
          />
        ))}
      </svg>
      {labels.length > 0 && (
        <figcaption className="flex flex-wrap gap-2 text-[10px] text-white/50">
          {labels.slice(0, Math.min(dimensions, 6)).map((label, index) => (
            <span key={label} className="inline-flex items-center gap-1">
              <span
                className="inline-block w-2 h-2 rounded-sm"
                style={{ background: SERIES_COLORS[index] }}
              />
              {label}
            </span>
          ))}
        </figcaption>
      )}
    </figure>
  );
}

function describeSeconds(seconds) {
  const total = Math.round(Number(seconds) || 0);
  if (total < 60) return `${total} s`;
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return rest ? `${minutes} min ${rest} s` : `${minutes} min`;
}

/**
 * What the platform has learned about how this avatar's person moves — the
 * numbers, the movements with their curves, the fidelity of generated clips,
 * and the exact text those numbers produce — with the one control that
 * forgets it all.
 *
 * @param {{ assistantId: string }} props
 */
export default function MotionProfilePanel({ assistantId }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!assistantId) return;
    setLoading(true);
    setError('');
    try {
      setProfile(await getAvatarMotionProfile(assistantId));
    } catch (loadError) {
      setError(loadError?.message ?? 'The motion profile could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [assistantId]);

  useEffect(() => {
    load();
  }, [load]);

  const forget = async () => {
    if (!assistantId || deleting) return;
    const confirmed = window.confirm(
      'Forget everything learned about how this person moves? Recorded tracks, the expression basis, recurring movements and the rendered text are all deleted.'
    );
    if (!confirmed) return;
    setDeleting(true);
    try {
      await deleteAvatarMotionTracks(assistantId);
      toast.success('Movement record deleted.');
      await load();
    } catch (deleteError) {
      toast.error(
        deleteError?.message ?? 'The movement record could not be deleted.'
      );
    } finally {
      setDeleting(false);
    }
  };

  const seconds = profile?.seconds_observed ?? 0;
  const blocks = profile?.blocks ?? {};
  const primitives = profile?.primitives ?? [];
  const fidelity = profile?.motion_fidelity ?? {};
  const hasAnything =
    seconds > 0 || primitives.length > 0 || (profile?.tracks?.count ?? 0) > 0;

  return (
    <section
      className="flex flex-col gap-4 min-w-0"
      aria-labelledby="motion-profile-heading"
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="motion-profile-heading"
            className="text-xl sm:text-2xl font-semibold text-neutral-200 mb-2 flex items-center gap-2"
          >
            <Activity size={22} />
            Motion
          </h2>
          <p className="text-sm text-white/60">
            How you move, learned from your webcam when it faces you and from
            videos of you that you upload. The words below are rendered from
            measurements, and they drive your stills, idle loops and lip-synced
            clips.
          </p>
        </div>
        <button
          type="button"
          onClick={forget}
          disabled={!hasAnything || deleting}
          className="self-start shrink-0 text-xs px-3 py-1.5 rounded-md border border-red-400/40 text-red-200 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {deleting ? 'Deleting…' : 'Unlearn trained motion'}
        </button>
      </div>

      {loading && !profile && <p className="text-sm text-white/50">Loading…</p>}
      {error && <p className="text-sm text-red-300">{error}</p>}

      {profile && !hasAnything && (
        <p className="text-sm text-white/50">
          Nothing recorded yet. Turn the webcam on while chatting with your
          personal avatar, or upload a video of yourself.
        </p>
      )}

      {profile && hasAnything && (
        <>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            <div className="rounded-md bg-white/5 p-2">
              <dt className="text-white/50 text-xs">Observed</dt>
              <dd className="text-white">{describeSeconds(seconds)}</dd>
            </div>
            <div className="rounded-md bg-white/5 p-2">
              <dt className="text-white/50 text-xs">Tracks kept</dt>
              <dd className="text-white">
                {profile.tracks?.count ?? 0} ·{' '}
                {describeSeconds(profile.tracks?.seconds)}
              </dd>
            </div>
            <div className="rounded-md bg-white/5 p-2">
              <dt className="text-white/50 text-xs">Expression basis</dt>
              <dd className="text-white">
                {profile.basis
                  ? `${profile.basis.component_count} components · error ${Number(profile.basis.reconstruction_error).toFixed(3)}`
                  : 'not yet fitted'}
              </dd>
            </div>
            <div className="rounded-md bg-white/5 p-2">
              <dt className="text-white/50 text-xs">Sources</dt>
              <dd className="text-white text-xs">
                {Object.entries(profile.tracks?.by_source ?? {})
                  .map(
                    ([source, count]) => `${source.replace(/_/g, ' ')} ${count}`
                  )
                  .join(' · ') || '—'}
              </dd>
            </div>
          </dl>

          {Object.keys(blocks).length > 0 ? (
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-semibold text-white/80">
                What the measurements say
              </h4>
              {Object.entries(blocks).map(([emotion, block]) => (
                <details
                  key={emotion}
                  open={emotion === 'neutral'}
                  className="rounded-md bg-black/30 border border-white/10"
                >
                  <summary className="cursor-pointer px-3 py-2 text-sm text-white/80 capitalize">
                    {emotion}
                  </summary>
                  <pre className="px-3 pb-3 text-xs text-white/70 whitespace-pre-wrap font-mono">
                    {block}
                  </pre>
                </details>
              ))}
            </div>
          ) : (
            <p className="text-sm text-white/50">
              Recorded, but not yet enough to state a habit — the text appears
              once a measurement rests on enough seconds to be reliable.
            </p>
          )}

          {primitives.length > 0 && (
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-semibold text-white/80">
                Recurring movements
              </h4>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {primitives.slice(0, 12).map((primitive) => (
                  <li
                    key={primitive.primitive_id}
                    className="rounded-md bg-white/5 p-2 flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between text-xs text-white/70">
                      <span>
                        {CHANNEL_LABELS[primitive.channel] ?? primitive.channel}
                        {primitive.emotion !== 'neutral'
                          ? ` · ${primitive.emotion}`
                          : ''}
                      </span>
                      <span>×{primitive.occurrences}</span>
                    </div>
                    <PrototypeChart primitive={primitive} />
                    <p className="text-[11px] text-white/50">
                      {Number(primitive.duration_mean).toFixed(2)} s ±{' '}
                      {Number(primitive.duration_std).toFixed(2)} · amplitude{' '}
                      {Number(primitive.amplitude_mean).toFixed(2)}
                      {primitive.context?.speaking != null ||
                      primitive.context?.silent != null
                        ? ` · speaking ${primitive.context.speaking ?? 0} / listening ${primitive.context.silent ?? 0}`
                        : ''}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {Object.keys(fidelity).length > 0 && (
            <div className="flex flex-col gap-1">
              <h4 className="text-sm font-semibold text-white/80">
                How closely generated clips match you
              </h4>
              <ul className="text-xs text-white/70 flex flex-wrap gap-2">
                {Object.entries(fidelity).map(([emotion, score]) => (
                  <li
                    key={emotion}
                    className="rounded bg-white/5 px-2 py-1 capitalize"
                  >
                    {emotion}: {Math.round((score?.overall ?? 0) * 100)}%
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
