import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  pathCarriesItsOwnQrCode,
  pathIsSignedOutAuthForm,
} from './qrBadgePath.js';

test('the landing screen at / and /welcome already has a QR code', () => {
  assert.equal(pathCarriesItsOwnQrCode('/'), true);
  assert.equal(pathCarriesItsOwnQrCode('/welcome'), true);
  assert.equal(pathCarriesItsOwnQrCode('/welcome/'), true);
});

test('login and signup hide the corner badge so the auth controls stay clear', () => {
  assert.equal(pathIsSignedOutAuthForm('/login'), true);
  assert.equal(pathIsSignedOutAuthForm('/signup'), true);
  assert.equal(pathIsSignedOutAuthForm('/login/'), true);
  assert.equal(pathIsSignedOutAuthForm('/signup/'), true);
  assert.equal(pathCarriesItsOwnQrCode('/login'), false);
  assert.equal(pathCarriesItsOwnQrCode('/signup'), false);
});

test('signed-out screens without a code still get the corner badge', () => {
  assert.equal(pathIsSignedOutAuthForm('/privacy'), false);
  assert.equal(pathCarriesItsOwnQrCode('/privacy'), false);
});
