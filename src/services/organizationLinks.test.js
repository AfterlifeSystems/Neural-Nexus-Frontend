import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  organizationLinksFromAvatar,
  organizationLinksFromText,
} from './organizationLinks.js';

const CLAIRE_PLACE_URL = 'https://clairesplacefoundation.org/';
const GRANT_STEAM_URL = 'https://www.grantimaharafoundation.org/';

test("Claire Wineland's description yields Claire's Place Foundation", () => {
  assert.deepEqual(
    organizationLinksFromText(
      "Founder of Claire's Place Foundation, supporting families living " +
        `with cystic fibrosis. ${CLAIRE_PLACE_URL}`
    ),
    [CLAIRE_PLACE_URL]
  );
});

test("Grant Imahara's description yields the STEAM Foundation", () => {
  assert.deepEqual(
    organizationLinksFromText(
      "Engineer and founder of Grant Imahara's STEAM Foundation. " +
        GRANT_STEAM_URL
    ),
    [GRANT_STEAM_URL]
  );
});

test('a YouTube channel is not an organization link', () => {
  assert.deepEqual(
    organizationLinksFromText(
      `Talks at https://www.youtube.com/@imahara and ${GRANT_STEAM_URL}`
    ),
    [GRANT_STEAM_URL]
  );
});

test('organization links are read from the avatar description', () => {
  assert.deepEqual(
    organizationLinksFromAvatar({
      name: 'Claire Wineland',
      description: `Founder of Claire's Place Foundation. ${CLAIRE_PLACE_URL}`,
    }),
    [CLAIRE_PLACE_URL]
  );
  assert.deepEqual(
    organizationLinksFromAvatar({
      name: 'Grant Imahara',
      metadata: {
        description: `Grant Imahara's STEAM Foundation. ${GRANT_STEAM_URL}`,
      },
    }),
    [GRANT_STEAM_URL]
  );
});
