import assert from 'node:assert/strict';
import { test } from 'node:test';
import { splitHttpUrlParts } from './linkifyHttpUrls.js';

const CLAIRE_PLACE_URL = 'https://clairesplacefoundation.org/';
const GRANT_STEAM_WWW = 'https://www.grantimaharafoundation.org/';
const GRANT_STEAM_BARE = 'https://grantimaharafoundation.org';

test("Claire's Place Foundation is a tappable link in the reply", () => {
  const parts = splitHttpUrlParts(
    `Claire's Place Foundation is here: ${CLAIRE_PLACE_URL}`
  );
  assert.equal(parts[1].type, 'link');
  assert.equal(parts[1].href, CLAIRE_PLACE_URL);
  assert.equal(parts[1].display, CLAIRE_PLACE_URL);
});

test("Grant Imahara's STEAM Foundation is a tappable link in the reply", () => {
  const parts = splitHttpUrlParts(
    `The STEAM Foundation lives at ${GRANT_STEAM_WWW} if you want to help.`
  );
  assert.equal(parts[1].type, 'link');
  assert.equal(parts[1].href, GRANT_STEAM_WWW);
  assert.match(parts[2].value, /if you want to help/);
});

test('You can learn more at https://grantimaharafoundation.org. is a hyperlink', () => {
  const parts = splitHttpUrlParts(
    'You can learn more at https://grantimaharafoundation.org.'
  );
  assert.deepEqual(
    parts.map((part) => part.type),
    ['text', 'link', 'text']
  );
  assert.equal(parts[0].value, 'You can learn more at ');
  assert.equal(parts[1].type, 'link');
  assert.equal(parts[1].display, GRANT_STEAM_BARE);
  assert.equal(parts[1].href, `${GRANT_STEAM_BARE}/`);
  assert.equal(parts[2].value, '.');
});

test('a markdown [url](url) wrap is still a single hyperlink', () => {
  const parts = splitHttpUrlParts(
    'You can learn more at [https://grantimaharafoundation.org](https://grantimaharafoundation.org).'
  );
  const link = parts.find((part) => part.type === 'link');
  assert.ok(link);
  assert.equal(link.display, GRANT_STEAM_BARE);
  assert.equal(link.href, `${GRANT_STEAM_BARE}/`);
  assert.equal(
    parts.some((part) => String(part.value ?? '').includes('](')),
    false
  );
});

test('a markdown label keeps its words and opens the href', () => {
  const parts = splitHttpUrlParts(
    'Visit [Grant Imahara STEAM Foundation](https://grantimaharafoundation.org).'
  );
  const link = parts.find((part) => part.type === 'link');
  assert.equal(link.display, 'Grant Imahara STEAM Foundation');
  assert.equal(link.href, `${GRANT_STEAM_BARE}/`);
});

test('plain speech without a URL stays a single text part', () => {
  assert.deepEqual(splitHttpUrlParts('Hey, how are you?'), [
    { type: 'text', value: 'Hey, how are you?' },
  ]);
});
