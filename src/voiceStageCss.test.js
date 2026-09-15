import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { WORLD_GLOBE_ATMOSPHERE_RGB } from './services/globeMap.js';

const sourceDirectory = dirname(fileURLToPath(import.meta.url));
const stylesheet = readFileSync(join(sourceDirectory, 'index.css'), 'utf8');

test('voice mode does not clip the idle-loop decoder host on html or body', () => {
  const grouped = stylesheet.match(
    /html\.voice-stage-open,\s*html\.voice-stage-open body,\s*html\.voice-stage-open #root\s*\{[^}]*overflow:\s*hidden/
  );
  assert.equal(grouped, null);

  const htmlBodyBlock = stylesheet.match(
    /html\.voice-stage-open,\s*html\.voice-stage-open body\s*\{([^}]+)\}/
  );
  assert.ok(htmlBodyBlock, 'html/body still contain overscroll while voice mode is open');
  assert.doesNotMatch(htmlBodyBlock[1], /overflow:\s*hidden/);
  assert.match(htmlBodyBlock[1], /overscroll-behavior:\s*none/);
});

test('the voice portrait hairline uses gallery glass, not the speak glow', () => {
  const variable = stylesheet.match(
    /--world-atmosphere-rgb:\s*([0-9]+,\s*[0-9]+,\s*[0-9]+)/
  );
  assert.ok(variable, 'stylesheet declares --world-atmosphere-rgb');
  assert.equal(variable[1].replace(/\s+/g, ' '), WORLD_GLOBE_ATMOSPHERE_RGB);

  assert.match(
    stylesheet,
    /--gallery-glass-border:\s*rgba\(\s*255,\s*255,\s*255,\s*0\.25\s*\)/
  );
  const frame = stylesheet.match(/\.voice-portrait-frame\s*\{([^}]+)\}/);
  assert.ok(frame, 'voice portrait frame is still drawn');
  assert.match(frame[1], /--gallery-glass-border/);
  assert.doesNotMatch(frame[1], /--world-atmosphere-rgb/);
  assert.doesNotMatch(frame[1], /--voice-speak-rgb/);
});

test('the talk pulse uses the globe atmosphere, not amber', () => {
  assert.match(
    stylesheet,
    /--voice-speak-rgb:\s*var\(--world-atmosphere-rgb\)/
  );
  assert.match(
    stylesheet,
    /--voice-speak-bright-rgb:\s*var\(--world-atmosphere-bright-rgb\)/
  );
  assert.doesNotMatch(stylesheet, /--voice-speak-rgb:\s*251,\s*191,\s*36/);
});
