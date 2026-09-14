import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  pageUrlOnLocalhost,
  replaceLoopbackPageWithLocalhost,
} from './loopbackPageUrl.js';

test('pageUrlOnLocalhost rewrites 127.0.0.1 onto localhost and keeps the rest', () => {
  assert.equal(
    pageUrlOnLocalhost('http://127.0.0.1:5173/avatars?tab=1#gallery'),
    'http://localhost:5173/avatars?tab=1#gallery'
  );
});

test('pageUrlOnLocalhost rewrites IPv6 loopback onto localhost', () => {
  assert.equal(
    pageUrlOnLocalhost('http://[::1]:5173/map'),
    'http://localhost:5173/map'
  );
  assert.equal(
    pageUrlOnLocalhost('http://[::1]:5173/avatars'),
    'http://localhost:5173/avatars'
  );
});

test('pageUrlOnLocalhost leaves localhost and remote hosts alone', () => {
  assert.equal(pageUrlOnLocalhost('http://localhost:5173/avatars'), null);
  assert.equal(pageUrlOnLocalhost('https://neuralnexus.site/avatars'), null);
});

test('pageUrlOnLocalhost rejects a missing or unusable address', () => {
  assert.equal(pageUrlOnLocalhost(''), null);
  assert.equal(pageUrlOnLocalhost('not a url'), null);
  assert.equal(pageUrlOnLocalhost(null), null);
});

test('replaceLoopbackPageWithLocalhost replaces a 127.0.0.1 tab', () => {
  const replaced = [];
  const didReplace = replaceLoopbackPageWithLocalhost({
    href: 'http://127.0.0.1:5173/avatars',
    replace(nextUrl) {
      replaced.push(nextUrl);
    },
  });
  assert.equal(didReplace, true);
  assert.deepEqual(replaced, ['http://localhost:5173/avatars']);
});

test('replaceLoopbackPageWithLocalhost does not touch a localhost tab', () => {
  let replaceCount = 0;
  const didReplace = replaceLoopbackPageWithLocalhost({
    href: 'http://localhost:5173/avatars',
    replace() {
      replaceCount += 1;
    },
  });
  assert.equal(didReplace, false);
  assert.equal(replaceCount, 0);
});
