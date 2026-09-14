import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  PIXEL_CARD_ORIGIN_X,
  PIXEL_CARD_ORIGIN_Y,
  pixelAppearDelay,
  pixelCardOriginCssPercent,
  pixelCardOriginFraction,
} from './pixelCardOrigin.js';

const componentsDirectory = dirname(fileURLToPath(import.meta.url));

test('the default origin is the card centre', () => {
  assert.equal(PIXEL_CARD_ORIGIN_X, 0.5);
  assert.equal(PIXEL_CARD_ORIGIN_Y, 0.5);
  assert.equal(pixelCardOriginCssPercent(PIXEL_CARD_ORIGIN_X), '50%');
  assert.equal(pixelCardOriginCssPercent(PIXEL_CARD_ORIGIN_Y), '50%');
});

test('a percent custom property maps back to the same fraction', () => {
  assert.equal(pixelCardOriginFraction('50%'), 0.5);
  assert.equal(pixelCardOriginFraction(' 46% '), 0.46);
  assert.equal(pixelCardOriginFraction('0.5'), 0.5);
  assert.equal(pixelCardOriginFraction(''), 0.5);
  assert.equal(pixelCardOriginFraction('nope', 0.25), 0.25);
});

test('appear delay is zero on the origin and grows equally in every direction', () => {
  assert.equal(pixelAppearDelay(100, 100, 200, 200), 0);
  assert.equal(pixelAppearDelay(100, 80, 200, 200), 20);
  assert.equal(pixelAppearDelay(100, 120, 200, 200), 20);
  assert.equal(pixelAppearDelay(80, 100, 200, 200), 20);
  assert.equal(pixelAppearDelay(120, 100, 200, 200), 20);
});

test('Create Avatar plus and PixelCard bloom share the origin custom properties', () => {
  const cardSource = readFileSync(
    join(componentsDirectory, 'CreateAvatarComponent.jsx'),
    'utf8'
  );
  const pixelSource = readFileSync(
    join(componentsDirectory, 'PixelCard.jsx'),
    'utf8'
  );
  const pixelCss = readFileSync(
    join(componentsDirectory, 'PixelCard.css'),
    'utf8'
  );
  assert.match(cardSource, /data-create-avatar-plus/);
  assert.match(cardSource, /left: 'var\(--pixel-card-origin-x\)'/);
  assert.match(cardSource, /top: 'var\(--pixel-card-origin-y\)'/);
  assert.doesNotMatch(cardSource, /top-\[46%\]/);
  assert.match(pixelSource, /pixelAppearDelay/);
  assert.match(pixelSource, /pixelCardOriginCssPercent\(PIXEL_CARD_ORIGIN_X\)/);
  assert.match(pixelSource, /pixelCardOriginCssPercent\(PIXEL_CARD_ORIGIN_Y\)/);
  assert.match(
    pixelCss,
    /circle at var\(--pixel-card-origin-x\) var\(--pixel-card-origin-y\)/
  );
  assert.match(pixelCss, /--pixel-card-origin-x:\s*50%/);
  assert.match(pixelCss, /--pixel-card-origin-y:\s*50%/);
});
