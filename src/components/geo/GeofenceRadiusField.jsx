// src/components/geo/GeofenceRadiusField.jsx
//
// Shared arrival-radius control. The stored value is metres. The person types
// in m, km, yd, or mi. The public default is 1 m — one step from the pin.

import { useCallback, useEffect, useRef, useState } from 'react';

import { isPartialDecimal, parseDecimal } from '../../services/placeSearch';
import {
  DEFAULT_GEOFENCE_RADIUS_METERS,
  DOORWAY_GEOFENCE_RADIUS_METERS,
  GEOFENCE_RADIUS_UNIT_ORDER,
  clampGeofenceRadius,
  describeGeofenceRadius,
  formatRadiusUnitValue,
  geofenceRadiusUnitOf,
  metersFromRadiusUnit,
  radiusUnitMinimum,
} from '../../services/avatarProximity';

const METRIC_UNITS = GEOFENCE_RADIUS_UNIT_ORDER.filter(
  (unitId) => geofenceRadiusUnitOf(unitId).group === 'metric'
);
const IMPERIAL_UNITS = GEOFENCE_RADIUS_UNIT_ORDER.filter(
  (unitId) => geofenceRadiusUnitOf(unitId).group === 'imperial'
);

/**
 * @param {Object} props
 * @param {number} [props.radiusMeters]
 * @param {(meters: number) => void} props.onChange
 * @param {'default'|'compact'} [props.appearance]
 */
const GeofenceRadiusField = ({
  radiusMeters = DEFAULT_GEOFENCE_RADIUS_METERS,
  onChange,
  appearance = 'default',
}) => {
  const [unitId, setUnitId] = useState('m');
  const committedMeters = clampGeofenceRadius(radiusMeters);
  const [text, setText] = useState(() =>
    formatRadiusUnitValue(committedMeters, 'm')
  );
  const emittedMetersRef = useRef(committedMeters);

  useEffect(() => {
    if (committedMeters === emittedMetersRef.current) return;
    emittedMetersRef.current = committedMeters;
    setText(formatRadiusUnitValue(committedMeters, unitId));
  }, [committedMeters, unitId]);

  const commitMeters = useCallback(
    (nextMeters) => {
      const clamped = clampGeofenceRadius(nextMeters);
      emittedMetersRef.current = clamped;
      onChange(clamped);
    },
    [onChange]
  );

  const switchUnit = useCallback(
    (nextUnitId) => {
      setUnitId(nextUnitId);
      setText(formatRadiusUnitValue(committedMeters, nextUnitId));
    },
    [committedMeters]
  );

  const onTextChange = useCallback(
    (nextText) => {
      if (!isPartialDecimal(nextText)) return;
      setText(nextText);
      const parsed = parseDecimal(nextText);
      if (parsed === null) return;
      commitMeters(metersFromRadiusUnit(parsed, unitId));
    },
    [commitMeters, unitId]
  );

  const onBlur = useCallback(() => {
    setText(formatRadiusUnitValue(committedMeters, unitId));
  }, [committedMeters, unitId]);

  const setDoorway = useCallback(() => {
    commitMeters(DOORWAY_GEOFENCE_RADIUS_METERS);
    setText(formatRadiusUnitValue(DOORWAY_GEOFENCE_RADIUS_METERS, unitId));
  }, [commitMeters, unitId]);

  const isCompact = appearance === 'compact';
  const unitButtonClass = (id) =>
    `rounded px-2 py-0.5 ${isCompact ? 'text-[10px]' : 'text-xs'} ${
      unitId === id ? 'bg-white/10 text-neutral-100' : 'text-white/50 hover:text-white/70'
    }`;

  return (
    <div className={isCompact ? 'space-y-1.5' : 'space-y-2'}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={
              isCompact
                ? 'text-white/50'
                : 'text-xs font-medium tracking-wide text-white/70'
            }
          >
            How close
          </p>
          {isCompact ? (
            <p className="text-[10px] leading-relaxed text-white/40">
              Closest is 1 m.
            </p>
          ) : (
            <p className="mt-0.5 text-[11px] leading-relaxed text-white/40">
              The circle is the arrival area. Closest is 1 m — a doorway. Type
              in m or km, or yd or mi. Nothing smaller than 1 m is sent.
            </p>
          )}
        </div>
        <p
          className={`shrink-0 tabular-nums ${
            isCompact ? 'text-xs text-white/70' : 'text-sm text-neutral-100'
          }`}
        >
          {describeGeofenceRadius(committedMeters)}
        </p>
      </div>
      <div className={`flex flex-wrap items-center ${isCompact ? 'gap-1' : 'gap-1.5'}`}>
        <div className="flex items-center gap-0.5 rounded-md border border-white/10 bg-black/40 p-0.5">
          {METRIC_UNITS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => switchUnit(id)}
              className={unitButtonClass(id)}
            >
              {id}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-0.5 rounded-md border border-white/10 bg-black/40 p-0.5">
          {IMPERIAL_UNITS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => switchUnit(id)}
              className={unitButtonClass(id)}
            >
              {id}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={setDoorway}
          className={
            isCompact
              ? 'rounded px-1.5 py-0.5 text-[10px] text-amber-300/80 hover:text-amber-200'
              : 'rounded-md border border-white/10 px-2 py-1 text-xs text-amber-300/80 hover:text-amber-200'
          }
        >
          1 m
        </button>
      </div>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-label={`Arrival radius in ${unitId}`}
        aria-valuemin={radiusUnitMinimum(unitId)}
        value={text}
        onChange={(changeEvent) => onTextChange(changeEvent.target.value)}
        onBlur={onBlur}
        className={
          isCompact
            ? 'w-full rounded border border-white/10 bg-black/40 px-1.5 py-1 text-neutral-200'
            : 'w-full rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-neutral-200 placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-amber-400/50'
        }
      />
    </div>
  );
};

export default GeofenceRadiusField;
