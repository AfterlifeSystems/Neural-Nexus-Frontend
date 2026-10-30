import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isDirectImageUrl } from './documentKind.js';

const imageUrl = (address) => isDirectImageUrl(new URL(address));

test('a link ending in an image extension is a direct image', () => {
  assert.equal(imageUrl('https://example.com/photos/portrait.JPG'), true);
  assert.equal(imageUrl('https://example.com/a/b/diagram.svg?v=2'), true);
});

test('an extensionless path with a format parameter is a direct image', () => {
  assert.equal(
    imageUrl('https://pbs.twimg.com/media/EqHPBwCXEAUnZig?format=jpg&name=large'),
    true
  );
  assert.equal(
    imageUrl('https://pbs.twimg.com/media/F4eey37WcAAjq5F?format=png&name=900x900'),
    true
  );
});

test('pages, unrenderable formats, and missing addresses are not direct images', () => {
  assert.equal(imageUrl('https://x.com/i/status/1122262308212707329'), false);
  assert.equal(imageUrl('https://example.com/article.html'), false);
  assert.equal(imageUrl('https://example.com/scan.tiff'), false);
  assert.equal(imageUrl('https://example.com/v1.2/report'), false);
  assert.equal(isDirectImageUrl(null), false);
});
