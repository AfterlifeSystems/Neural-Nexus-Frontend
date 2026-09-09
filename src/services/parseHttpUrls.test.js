import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHttpUrls } from './parseHttpUrls.js';

test('parseHttpUrls returns an empty list for blank or non-url text', () => {
  assert.deepEqual(parseHttpUrls(''), []);
  assert.deepEqual(parseHttpUrls('   '), []);
  assert.deepEqual(parseHttpUrls('not a url'), []);
  assert.deepEqual(parseHttpUrls('ftp://example.com/file'), []);
});

test('parseHttpUrls keeps a single http(s) URL', () => {
  assert.deepEqual(parseHttpUrls('https://example.com/a'), [
    'https://example.com/a',
  ]);
  assert.deepEqual(parseHttpUrls('  http://example.com/b  '), [
    'http://example.com/b',
  ]);
});

test('parseHttpUrls splits a pasted list and drops duplicates', () => {
  assert.deepEqual(
    parseHttpUrls(
      'https://youtu.be/dQw4w9WgXcQ\nhttps://example.com/two, https://example.com/two'
    ),
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://example.com/two']
  );
});

test('parseHttpUrls collapses YouTube watch and youtu.be links for the same video', () => {
  assert.deepEqual(
    parseHttpUrls(
      'https://www.youtube.com/watch?v=lfLKHY52ERc&list=WL&index=54\nhttps://youtu.be/lfLKHY52ERc?si=0alyoKlhLiZhiDAF'
    ),
    ['https://www.youtube.com/watch?v=lfLKHY52ERc']
  );
});

test('parseHttpUrls ignores uri-list comments', () => {
  assert.deepEqual(
    parseHttpUrls('# comment\nhttps://example.com/page\nhttps://example.com/other'),
    ['https://example.com/page', 'https://example.com/other']
  );
});
