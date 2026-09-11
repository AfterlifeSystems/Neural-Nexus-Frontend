import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  HOSTED_BROWSER_LOGIN_MODE,
  OWN_BROWSER_LOGIN_MODE,
  hostedWindowRetry,
  ownBrowserInstructions,
  ownBrowserLoginFromStart,
  ownBrowserSignInFailure,
  ownBrowserSignInSucceeded,
  startedInOwnBrowser,
} from './ownBrowserSignIn.js';

const startedInTheirBrowser = {
  login_id: 'login-1',
  login_token: 'token-1',
  login_mode: OWN_BROWSER_LOGIN_MODE,
  nonce: 'nonce-1',
  provider: 'instagram',
  site_url: 'https://www.instagram.com/accounts/login/',
  site_hostname: 'www.instagram.com',
  device_label: "Evan's desktop",
  expires_in: 1800,
  instructions:
    "www.instagram.com is open in your browser on Evan's desktop. Sign in there, then say you are done.",
};

const startedInAHostedWindow = {
  login_id: 'login-2',
  login_mode: HOSTED_BROWSER_LOGIN_MODE,
  nonce: 'nonce-2',
  view_url: '/connect_account/browser/login-2?t=token',
};

test('an answer naming the owner\'s own browser is recognised', () => {
  assert.equal(startedInOwnBrowser(startedInTheirBrowser), true);
  assert.equal(startedInOwnBrowser(startedInAHostedWindow), false);
  assert.equal(startedInOwnBrowser(null), false);
  assert.equal(startedInOwnBrowser({}), false);
});

test('the held login carries what the card needs to finish and to explain', () => {
  const login = ownBrowserLoginFromStart(startedInTheirBrowser, {
    loginEndpoint: '/connect_account/browser/start',
    loginRequest: { provider: 'instagram', name: 'work' },
  });
  assert.equal(login.login_id, 'login-1');
  assert.equal(login.login_token, 'token-1');
  assert.equal(login.device_label, "Evan's desktop");
  assert.equal(login.site_hostname, 'www.instagram.com');
  assert.deepEqual(login.login_request, { provider: 'instagram', name: 'work' });
});

test('a hosted-window answer is never held as an own-browser sign-in', () => {
  assert.equal(ownBrowserLoginFromStart(startedInAHostedWindow), null);
  assert.equal(
    ownBrowserLoginFromStart({ login_mode: OWN_BROWSER_LOGIN_MODE }),
    null,
    'an answer with no login id cannot be finished, so it is not held'
  );
});

test("the API's own sentence is what the owner reads", () => {
  assert.equal(
    ownBrowserInstructions(ownBrowserLoginFromStart(startedInTheirBrowser)),
    startedInTheirBrowser.instructions
  );
});

test('an older API that sent no sentence still names the site and the machine', () => {
  const login = ownBrowserLoginFromStart({
    ...startedInTheirBrowser,
    instructions: '',
  });
  const line = ownBrowserInstructions(login);
  assert.match(line, /www\.instagram\.com/);
  assert.match(line, /Evan's desktop/);
});

test('a login with nothing named still reads as a sentence', () => {
  const line = ownBrowserInstructions(null);
  assert.match(line, /The sign-in page is open in your browser on your machine/);
});

test('signing in here instead asks the same endpoint for the hosted window', () => {
  const login = ownBrowserLoginFromStart(startedInTheirBrowser, {
    loginEndpoint: '/connect_account/browser/start',
    loginRequest: { provider: 'instagram', name: 'work' },
  });
  const retry = hostedWindowRetry(login, 'instagram');
  assert.equal(retry.login_endpoint, '/connect_account/browser/start');
  assert.deepEqual(retry.login_request, {
    provider: 'instagram',
    name: 'work',
    use_hosted_browser: true,
  });
});

test('a retry with no held login still names the provider', () => {
  const retry = hostedWindowRetry(null, 'instagram');
  assert.equal(retry.login_endpoint, '/connect_account/browser/start');
  assert.deepEqual(retry.login_request, {
    provider: 'instagram',
    use_hosted_browser: true,
  });
});

test('a finish that connected the account is recognised', () => {
  assert.equal(
    ownBrowserSignInSucceeded({ ok: true, account_key: 'instagram:x#ab' }),
    true
  );
  assert.equal(ownBrowserSignInSucceeded({ ok: false, error: 'no' }), false);
  assert.equal(ownBrowserSignInSucceeded(undefined), false);
});

test("a failed finish shows the daemon's own words, not a generic line", () => {
  assert.equal(
    ownBrowserSignInFailure(
      { ok: false, error: 'Sign in to www.instagram.com in your browser first.' },
      'Instagram'
    ),
    'Sign in to www.instagram.com in your browser first.'
  );
  assert.equal(
    ownBrowserSignInFailure({ ok: false }, 'Instagram'),
    'Instagram was not connected.'
  );
});
