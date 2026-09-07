import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  artifactNamesRenderedByCharts,
  chartHasRenderableData,
  chartRows,
  chartsOf,
  formatChartValue,
  pieSlices,
  pngArtifactFor,
  unitOf,
} from './chartSpecs.js';

const visits = {
  chart_id: 'c1',
  type: 'line',
  title: 'Visits',
  x: { label: 'Day', values: ['Mon', 'Tue', 'Wed'] },
  series: [
    { name: 'Visits', values: [10, 20, 30] },
    { name: 'Signups', values: [1, null, 3], unit: 'people' },
  ],
  unit: '',
  png_artifact_name: 'visits.png',
};

test('charts are read from the live list first, then the stored metadata', () => {
  assert.deepEqual(chartsOf({ response_metadata: { charts: [visits] } }), [visits]);
  assert.deepEqual(chartsOf({ charts: [], response_metadata: { charts: [visits] } }), []);
  assert.deepEqual(chartsOf({}), []);
  assert.deepEqual(chartsOf(null), []);
});

test('a chart is renderable only with a known type and a numeric value', () => {
  assert.equal(chartHasRenderableData(visits), true);
  assert.equal(chartHasRenderableData({ ...visits, type: 'scatter' }), false);
  assert.equal(chartHasRenderableData({ ...visits, series: [] }), false);
  assert.equal(
    chartHasRenderableData({ ...visits, series: [{ name: 'a', values: [null, 'x'] }] }),
    false
  );
  assert.equal(chartHasRenderableData(null), false);
});

test('rows carry one object per x value keyed by series name', () => {
  assert.deepEqual(chartRows(visits), [
    { name: 'Mon', Visits: 10, Signups: 1 },
    { name: 'Tue', Visits: 20, Signups: null },
    { name: 'Wed', Visits: 30, Signups: 3 },
  ]);
  assert.deepEqual(chartRows({ series: [{ name: 'a', values: [1, 2] }] }), [
    { name: '1', a: 1 },
    { name: '2', a: 2 },
  ]);
});

test('pie slices come from the first series and drop what cannot be drawn', () => {
  assert.deepEqual(
    pieSlices({
      type: 'pie',
      x: { values: ['A', 'B', 'C'] },
      series: [{ name: 'Share', values: [3, -1, 'x'] }],
    }),
    [{ name: 'A', value: 3 }]
  );
  assert.deepEqual(pieSlices({}), []);
});

test('the PNG for a chart is found by name and hidden from the artifact list', () => {
  const png = { name: 'visits.png', mime_type: 'image/png' };
  const report = { name: 'report.md', mime_type: 'text/markdown' };
  assert.equal(pngArtifactFor(visits, [report, png]), png);
  assert.equal(pngArtifactFor(visits, [report]), null);
  assert.equal(pngArtifactFor({}, [png]), null);
  assert.deepEqual(
    [...artifactNamesRenderedByCharts([visits, { ...visits, type: 'nope', png_artifact_name: 'x.png' }])],
    ['visits.png']
  );
});

test('values are formatted with the unit where a reader expects the unit', () => {
  assert.equal(formatChartValue(12.5, '%'), '12.5%');
  assert.equal(formatChartValue(1500, '$'), '$1.5K');
  assert.equal(formatChartValue(3, 'USD'), '3 USD');
  assert.equal(formatChartValue(3, 'people'), '3 people');
  assert.equal(formatChartValue(3), '3');
  assert.equal(formatChartValue('n/a'), 'n/a');
  assert.equal(formatChartValue(null), '');
  assert.equal(unitOf(visits, visits.series[1]), 'people');
  assert.equal(unitOf({ unit: 'ms' }, { name: 'a' }), 'ms');
  assert.equal(unitOf({}), '');
});
