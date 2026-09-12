import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathCarriesItsOwnQrCode } from './qrBadgePath.js';

test('the landing screen at / and /welcome already has a QR code', () => {
  assert.equal(pathCarriesItsOwnQrCode('/'), true);
  assert.equal(pathCarriesItsOwnQrCode('/welcome'), true);
  assert.equal(pathCarriesItsOwnQrCode('/welcome/'), true);
});

test('signed-out screens without a code still get the corner badge', () => {
  assert.equal(pathCarriesItsOwnQrCode('/login'), false);
  assert.equal(pathCarriesItsOwnQrCode('/signup'), false);
  assert.equal(pathCarriesItsOwnQrCode('/privacy'), false);
});
