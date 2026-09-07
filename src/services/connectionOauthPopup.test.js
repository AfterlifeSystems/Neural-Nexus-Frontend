import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LOGIN_RESULT_MESSAGE_TYPE,
  absoluteApiUrl,
  accountKeyOfRow,
  apiOriginOf,
  navigatePopup,
  openPopupSynchronously,
  parseLoginResultMessage,
  pollUntilConnected,
  rowMatchesLogin,
} from './connectionOauthPopup.js';

test('the API origin is the scheme, host, and port of the base URL', () => {
  assert.equal(apiOriginOf('http://localhost:8080'), 'http://localhost:8080');
  assert.equal(apiOriginOf('https://api.example.com/v1/'), 'https://api.example.com');
  assert.equal(apiOriginOf('not a url'), '');
  assert.equal(apiOriginOf(''), '');
});

test('a path answered by the API is made absolute; a full URL is left alone', () => {
  assert.equal(
    absoluteApiUrl('/connect_account/plaid/link?nonce=abc', 'http://localhost:8080/'),
    'http://localhost:8080/connect_account/plaid/link?nonce=abc'
  );
  assert.equal(
    absoluteApiUrl('connect_account/browser/view/1', 'http://localhost:8080'),
    'http://localhost:8080/connect_account/browser/view/1'
  );
  assert.equal(
    absoluteApiUrl('https://accounts.google.com/o/oauth2/auth?x=1', 'http://localhost:8080'),
    'https://accounts.google.com/o/oauth2/auth?x=1'
  );
  assert.equal(absoluteApiUrl('', 'http://localhost:8080'), '');
});

test('a login result is accepted only from the API origin with the right nonce', () => {
  const expectations = { expectedOrigin: 'http://localhost:8080', nonce: 'n1' };
  const result = {
    type: LOGIN_RESULT_MESSAGE_TYPE,
    ok: true,
    nonce: 'n1',
    provider: 'gmail',
    account_key: 'gmail:evan@example.com',
  };
  assert.deepEqual(
    parseLoginResultMessage({ origin: 'http://localhost:8080', data: result }, expectations),
    result
  );
  assert.equal(
    parseLoginResultMessage({ origin: 'https://evil.example', data: result }, expectations),
    null
  );
  assert.equal(
    parseLoginResultMessage(
      { origin: 'http://localhost:8080', data: { ...result, nonce: 'other' } },
      expectations
    ),
    null
  );
  assert.equal(
    parseLoginResultMessage(
      { origin: 'http://localhost:8080', data: { type: 'something-else', nonce: 'n1' } },
      expectations
    ),
    null
  );
  assert.equal(
    parseLoginResultMessage({ origin: 'http://localhost:8080', data: 'text' }, expectations),
    null
  );
  assert.equal(parseLoginResultMessage(null, expectations), null);
});

test('the poll returns the first matching row and skips failed listings', async () => {
  let calls = 0;
  const listConnections = async () => {
    calls += 1;
    if (calls === 1) throw new Error('offline');
    if (calls === 2) return { connections: [] };
    return { connections: [{ provider: 'gmail', connected: true, connection_key: 'account:gmail:a' }] };
  };
  const slept = [];
  const row = await pollUntilConnected({
    listConnections,
    matches: (candidate) => candidate.provider === 'gmail',
    intervalMs: 5,
    timeoutMs: 1_000,
    sleep: async (milliseconds) => {
      slept.push(milliseconds);
    },
  });
  assert.equal(row.connection_key, 'account:gmail:a');
  assert.equal(calls, 3);
  assert.deepEqual(slept, [5, 5]);
});

test('the poll gives up at the timeout and stops when aborted', async () => {
  let clock = 0;
  const timedOut = await pollUntilConnected({
    listConnections: async () => [],
    matches: () => true,
    intervalMs: 10,
    timeoutMs: 25,
    now: () => clock,
    sleep: async (milliseconds) => {
      clock += milliseconds;
    },
  });
  assert.equal(timedOut, null);

  const abortController = new AbortController();
  let listings = 0;
  const aborted = await pollUntilConnected({
    listConnections: async () => {
      listings += 1;
      abortController.abort();
      return [];
    },
    matches: () => true,
    intervalMs: 10,
    timeoutMs: 10_000,
    signal: abortController.signal,
    sleep: async () => {},
  });
  assert.equal(aborted, null);
  assert.equal(listings, 1);
});

test('a row matches the login by account key when known, else by being new', () => {
  const existing = { provider: 'gmail', connected: true, connection_key: 'account:gmail:old' };
  const fresh = { provider: 'gmail', connected: true, connection_key: 'account:gmail:new' };
  const other = { provider: 'slack', connected: true, connection_key: 'account:slack:x' };
  const disconnected = { provider: 'gmail', connected: false, connection_key: 'account:gmail:new' };
  const expectations = { provider: 'gmail', knownAccountKeys: ['gmail:old'] };
  assert.equal(rowMatchesLogin(fresh, expectations), true);
  assert.equal(rowMatchesLogin(existing, expectations), false);
  assert.equal(rowMatchesLogin(other, expectations), false);
  assert.equal(rowMatchesLogin(disconnected, expectations), false);
  assert.equal(
    rowMatchesLogin(existing, { provider: 'gmail', accountKey: 'gmail:old' }),
    true
  );
  assert.equal(
    rowMatchesLogin(fresh, { provider: 'gmail', accountKey: 'gmail:old' }),
    false
  );
  assert.equal(accountKeyOfRow({ connection_key: 'account:gmail:a' }), 'gmail:a');
  assert.equal(accountKeyOfRow({ account_key: 'gmail:b', connection_key: 'account:gmail:b' }), 'gmail:b');
});

test('opening a popup without a window yields null and navigating null is false', () => {
  assert.equal(openPopupSynchronously('neural-nexus-login'), null);
  assert.equal(navigatePopup(null, 'http://localhost:8080/x'), false);
  const popup = { location: { href: 'about:blank' }, focus() {} };
  assert.equal(navigatePopup(popup, 'http://localhost:8080/x'), true);
  assert.equal(popup.location.href, 'http://localhost:8080/x');
});
