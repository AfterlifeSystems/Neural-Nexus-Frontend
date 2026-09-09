// src/components/ChartCard.jsx
import React from 'react';
import { Download } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { artifactDataUrl } from '../services/createdArtifacts';
import {
  chartHasRenderableData,
  chartRows,
  formatChartValue,
  pieSlices,
  unitOf,
} from '../services/chartSpecs';

// Brand-neutral series colours that read on the app's black ground.
const SERIES_COLORS = [
  '#fbbf24',
  '#38bdf8',
  '#a3e635',
  '#f472b6',
  '#c084fc',
  '#fb923c',
  '#2dd4bf',
  '#f87171',
];
const GRID_STROKE = 'rgba(255,255,255,0.08)';
const AXIS_LINE = { stroke: 'rgba(255,255,255,0.15)' };
const AXIS_TICK = { fill: 'rgba(255,255,255,0.6)', fontSize: 11 };
const TOOLTIP_CONTENT_STYLE = {
  backgroundColor: 'rgba(0,0,0,0.88)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  color: '#e5e5e5',
  fontSize: 12,
};
const TOOLTIP_LABEL_STYLE = { color: 'rgba(255,255,255,0.7)' };
const LEGEND_STYLE = { fontSize: 11, color: 'rgba(255,255,255,0.7)' };

/**
 * One chart from a reply's `response_metadata.charts`, drawn with Recharts.
 *
 * The spec is `{chart_id, type, title, x: {label, values[]}, series:
 * [{name, values[], unit}], unit, notes, png_artifact_name}`. The same chart
 * exists as a PNG among the reply's artifacts; when this card renders, the
 * PNG is hidden from the file list and offered here as a download instead.
 *
 * @param {Object} parameters
 * @param {Object} parameters.chart The chart spec.
 * @param {Object} [parameters.pngArtifact] The matching PNG artifact record.
 * @param {boolean} [parameters.compact] Shorter chart for the caption strip.
 */
const ChartCard = ({ chart, pngArtifact = null, compact = false }) => {
  if (!chartHasRenderableData(chart)) return null;

  const series = Array.isArray(chart.series) ? chart.series : [];
  const rows = chartRows(chart);
  const height = compact ? 180 : 260;
  const showLegend = series.length > 1;
  const chartUnit = unitOf(chart);
  const unitBySeries = Object.fromEntries(
    series.map((entry) => [entry?.name ?? 'value', unitOf(chart, entry)])
  );
  const tooltipFormatter = (value, name) => [
    formatChartValue(value, unitBySeries[name] ?? chartUnit),
    name,
  ];
  const axisFormatter = (value) => formatChartValue(value, chartUnit);
  const pngUrl = pngArtifact ? artifactDataUrl(pngArtifact) : null;

  const axes = (
    <>
      <CartesianGrid stroke={GRID_STROKE} vertical={false} />
      <XAxis
        dataKey="name"
        tick={AXIS_TICK}
        axisLine={AXIS_LINE}
        tickLine={false}
        interval="preserveStartEnd"
        minTickGap={12}
      />
      <YAxis
        tick={AXIS_TICK}
        axisLine={false}
        tickLine={false}
        width={compact ? 40 : 52}
        tickFormatter={axisFormatter}
      />
      <Tooltip
        formatter={tooltipFormatter}
        contentStyle={TOOLTIP_CONTENT_STYLE}
        labelStyle={TOOLTIP_LABEL_STYLE}
        cursor={{ stroke: 'rgba(255,255,255,0.2)', fill: 'rgba(255,255,255,0.05)' }}
      />
      {showLegend && <Legend wrapperStyle={LEGEND_STYLE} />}
    </>
  );

  let plot;
  if (chart.type === 'pie') {
    const slices = pieSlices(chart);
    plot = (
      <PieChart>
        <Tooltip
          formatter={(value, name) => [formatChartValue(value, chartUnit), name]}
          contentStyle={TOOLTIP_CONTENT_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
        />
        <Legend wrapperStyle={LEGEND_STYLE} />
        <Pie
          data={slices}
          dataKey="value"
          nameKey="name"
          innerRadius={compact ? 30 : 45}
          outerRadius={compact ? 60 : 90}
          paddingAngle={2}
          stroke="rgba(0,0,0,0.6)"
        >
          {slices.map((slice, index) => (
            <Cell
              key={`${slice.name}-${index}`}
              fill={SERIES_COLORS[index % SERIES_COLORS.length]}
            />
          ))}
        </Pie>
      </PieChart>
    );
  } else if (chart.type === 'bar' || chart.type === 'stacked_bar') {
    const stacked = chart.type === 'stacked_bar';
    plot = (
      <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        {axes}
        {series.map((entry, index) => (
          <Bar
            key={entry?.name ?? index}
            dataKey={entry?.name ?? 'value'}
            stackId={stacked ? 'stack' : undefined}
            fill={SERIES_COLORS[index % SERIES_COLORS.length]}
            radius={stacked ? 0 : [3, 3, 0, 0]}
            maxBarSize={48}
          />
        ))}
      </BarChart>
    );
  } else if (chart.type === 'area') {
    plot = (
      <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        {axes}
        {series.map((entry, index) => {
          const color = SERIES_COLORS[index % SERIES_COLORS.length];
          return (
            <Area
              key={entry?.name ?? index}
              type="monotone"
              dataKey={entry?.name ?? 'value'}
              stroke={color}
              fill={color}
              fillOpacity={0.18}
              strokeWidth={2}
              connectNulls
              dot={false}
            />
          );
        })}
      </AreaChart>
    );
  } else {
    plot = (
      <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        {axes}
        {series.map((entry, index) => (
          <Line
            key={entry?.name ?? index}
            type="monotone"
            dataKey={entry?.name ?? 'value'}
            stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
            strokeWidth={2}
            connectNulls
            dot={rows.length <= 24}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    );
  }

  return (
    <figure
      className={`mt-2 w-full min-w-0 rounded-xl border border-white/10 bg-black/40 ${
        compact ? 'p-2' : 'p-3'
      }`}
      data-chart-id={chart.chart_id ?? ''}
    >
      {(chart.title || chart.notes) && (
        <figcaption className="mb-2 min-w-0">
          {chart.title && (
            <p className="text-neutral-200 text-sm font-medium break-words">
              {chart.title}
            </p>
          )}
          {chart.notes && !compact && (
            <p className="text-white/50 text-xs break-words">{chart.notes}</p>
          )}
        </figcaption>
      )}
      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {plot}
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex items-center gap-3 text-xs text-white/50 min-w-0">
        {chart.x?.label && chart.type !== 'pie' && (
          <span className="truncate">{chart.x.label}</span>
        )}
        {chartUnit && <span className="truncate">Unit: {chartUnit}</span>}
        {pngUrl && (
          <a
            href={pngUrl}
            download={pngArtifact.name}
            className="ml-auto inline-flex items-center gap-1 underline text-amber-300 shrink-0"
          >
            <Download className="w-3 h-3" aria-hidden="true" />
            Download PNG
          </a>
        )}
      </div>
    </figure>
  );
};

export default ChartCard;
