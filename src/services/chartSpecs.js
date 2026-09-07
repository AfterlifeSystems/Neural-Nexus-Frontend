// src/services/chartSpecs.js
//
// The chart specs an analytics turn carries on `response_metadata.charts`.
// Each spec is `{chart_id, type, title, x: {label, values[]}, series:
// [{name, values[], unit}], unit, notes, png_artifact_name}`; the same chart
// is also rendered to a PNG among the reply's `created_artifacts`. A spec
// renders interactively when the spec has data, and then the PNG is hidden
// from the artifact list so the chart is not shown twice.

export const CHART_TYPES = ['line', 'bar', 'area', 'pie', 'stacked_bar'];

/**
 * A number a chart can plot, or null for a gap (null, undefined, blank,
 * anything not numeric). `Number(null)` is zero, which would draw a missing
 * point as a real zero.
 *
 * @param {*} raw
 * @returns {number|null}
 */
export function numericOrNull(raw) {
  if (raw == null || raw === '') return null;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : null;
}

/**
 * The chart specs a message carries, or an empty list.
 *
 * @param {Object} message A transcript message.
 * @returns {Object[]}
 */
export function chartsOf(message) {
  if (!message) return [];
  if (Array.isArray(message.charts)) return message.charts;
  const stored = message.response_metadata?.charts;
  return Array.isArray(stored) ? stored : [];
}

/**
 * Whether a spec holds something a chart can be drawn from: a known type,
 * at least one series, and at least one numeric value in some series.
 *
 * @param {Object} chart A chart spec.
 * @returns {boolean}
 */
export function chartHasRenderableData(chart) {
  if (!chart || typeof chart !== 'object') return false;
  if (!CHART_TYPES.includes(chart.type)) return false;
  const series = Array.isArray(chart.series) ? chart.series : [];
  if (series.length === 0) return false;
  return series.some(
    (entry) =>
      Array.isArray(entry?.values) &&
      entry.values.some((value) => numericOrNull(value) != null)
  );
}

/**
 * Rows for Recharts: one object per x value with a key per series.
 *
 * @param {Object} chart A chart spec.
 * @returns {Object[]}
 */
export function chartRows(chart) {
  const xValues = Array.isArray(chart?.x?.values) ? chart.x.values : [];
  const series = Array.isArray(chart?.series) ? chart.series : [];
  const length = Math.max(
    xValues.length,
    ...series.map((entry) => (Array.isArray(entry?.values) ? entry.values.length : 0))
  );
  const rows = [];
  for (let index = 0; index < length; index += 1) {
    const row = { name: xValues[index] ?? String(index + 1) };
    for (const entry of series) {
      const raw = Array.isArray(entry?.values) ? entry.values[index] : null;
      row[entry?.name ?? 'value'] = numericOrNull(raw);
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Slices for a pie chart: the first series as label/value pairs.
 *
 * @param {Object} chart A chart spec.
 * @returns {Object[]}
 */
export function pieSlices(chart) {
  const first = Array.isArray(chart?.series) ? chart.series[0] : null;
  if (!first) return [];
  const xValues = Array.isArray(chart?.x?.values) ? chart.x.values : [];
  return (Array.isArray(first.values) ? first.values : [])
    .map((value, index) => ({
      name: xValues[index] ?? String(index + 1),
      value: numericOrNull(value),
    }))
    .filter((slice) => slice.value != null && slice.value >= 0);
}

/**
 * The PNG artifact that pictures a chart, when the reply carries one.
 *
 * @param {Object} chart A chart spec.
 * @param {Object[]} artifacts The reply's created artifacts.
 * @returns {Object|null}
 */
export function pngArtifactFor(chart, artifacts) {
  const wanted = chart?.png_artifact_name;
  if (!wanted || !Array.isArray(artifacts)) return null;
  return artifacts.find((artifact) => artifact?.name === wanted) ?? null;
}

/**
 * Artifact names to leave out of the file list because a chart renders them.
 *
 * @param {Object[]} charts The reply's chart specs.
 * @returns {Set<string>}
 */
export function artifactNamesRenderedByCharts(charts) {
  const names = new Set();
  for (const chart of Array.isArray(charts) ? charts : []) {
    if (chartHasRenderableData(chart) && chart.png_artifact_name) {
      names.add(chart.png_artifact_name);
    }
  }
  return names;
}

/**
 * A value with the chart's unit, for an axis or a tooltip.
 *
 * Currency and percent units go where a reader expects them; anything else
 * follows the number with a space.
 *
 * @param {number|string} value
 * @param {string} [unit]
 * @returns {string}
 */
export function formatChartValue(value, unit) {
  if (value == null || value === '') return '';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value == null ? '' : String(value);
  const compact = Math.abs(numeric) >= 1000
    ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 1, notation: 'compact' }).format(numeric)
    : new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(numeric);
  const label = String(unit ?? '').trim();
  if (!label) return compact;
  if (label === '%') return `${compact}%`;
  if (['$', '€', '£', '¥'].includes(label)) return `${label}${compact}`;
  if (/^[A-Z]{3}$/.test(label)) return `${compact} ${label}`;
  return `${compact} ${label}`;
}

/**
 * The unit a series is measured in: the series' own, else the chart's.
 *
 * @param {Object} chart
 * @param {Object} [series]
 * @returns {string}
 */
export function unitOf(chart, series = null) {
  return String(series?.unit ?? chart?.unit ?? '').trim();
}
