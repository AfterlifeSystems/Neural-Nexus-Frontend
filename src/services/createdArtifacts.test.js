import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  artifactDataUrl,
  artifactText,
  createdArtifactsOf,
  formatArtifactSize,
  speakableReplyText,
  stripArtifactReferences,
} from './createdArtifacts.js';

const plot = {
  name: 'plot_walking_speed.png',
  mime_type: 'image/png',
  size_bytes: 3,
  encoding: 'base64',
  content: 'AQID',
};
const report = {
  name: 'report.md',
  mime_type: 'text/markdown',
  size_bytes: 7,
  encoding: 'utf-8',
  content: '# Speed',
};

test('artifacts are read from response_metadata and default to an empty list', () => {
  assert.deepEqual(
    createdArtifactsOf({ response_metadata: { created_artifacts: [plot] } }),
    [plot]
  );
  assert.deepEqual(createdArtifactsOf({ response_metadata: {} }), []);
  assert.deepEqual(createdArtifactsOf(null), []);
});

test('a base64 plot becomes an image data URL and a text report keeps its text', () => {
  assert.equal(artifactDataUrl(plot), 'data:image/png;base64,AQID');
  assert.equal(artifactText(report), '# Speed');
  assert.equal(
    artifactText({ ...report, encoding: 'base64', content: btoa('# Speed') }),
    '# Speed'
  );
  assert.equal(artifactDataUrl({ ...plot, content: null }), null);
});

test('artifact references the browser cannot fetch are stripped from shown text', () => {
  const reply =
    'Your speed averaged 2.5 mi/hr.\n\n![Walking speed over time](attachment:/data_created/plot_walking_speed.png)\n\nSee [the report](/data_created/report.md).';
  assert.equal(
    stripArtifactReferences(reply),
    'Your speed averaged 2.5 mi/hr.\n\nSee .'
  );
  assert.equal(stripArtifactReferences('bare attachment:/data_created/x.png here'), 'bare  here');
  assert.equal(stripArtifactReferences(''), '');
  assert.equal(stripArtifactReferences(undefined), '');
});

test('spoken text drops every markdown image, not only artifact ones', () => {
  assert.equal(
    speakableReplyText('Look: ![face](https://example.com/a.png) done.'),
    'Look:  done.'
  );
});

test('sizes are formatted for captions', () => {
  assert.equal(formatArtifactSize(512), '512 B');
  assert.equal(formatArtifactSize(12_800), '12.5 KB');
  assert.equal(formatArtifactSize(3 * 1024 * 1024), '3.0 MB');
});
